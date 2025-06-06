"""
Authentication routes for the LMS.
Implements secure login, logout, password reset, and 2FA functionality.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, Dict, Any
import structlog
from datetime import datetime

from database import get_db
from models.user import User
from models.audit_log import AuditLog
from models.otp import OTP, TOTPManager
from auth.security import (
    AuthenticationService,
    SecurityManager,
    get_current_user,
    get_current_active_user
)
from services.email_service import EmailService
from services.sms_service import SMSService

logger = structlog.get_logger()

auth_router = APIRouter()

# Pydantic models for request/response
class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False
    
    @validator('password')
    def password_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('Password cannot be empty')
        return v

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str
    user: Dict[str, Any]
    requires_2fa: bool = False
    redirect_url: str

class TwoFactorRequest(BaseModel):
    email: EmailStr
    otp_code: str
    remember_device: bool = False

class PasswordResetRequest(BaseModel):
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_password_strength(cls, v):
        # Same validation as PasswordResetConfirm
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not any(c.isupper() for c in v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not any(c.islower() for c in v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c in '!@#$%^&*()_+-=[]{}|;:,.<>?' for c in v):
            raise ValueError('Password must contain at least one special character')
        return v

def get_client_info(request: Request) -> tuple[str, str]:
    """Extract client IP and user agent from request."""
    # Get real IP address (considering proxies)
    ip_address = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
        request.headers.get("x-real-ip", "") or
        request.client.host if request.client else "unknown"
    )
    
    user_agent = request.headers.get("user-agent", "unknown")
    return ip_address, user_agent

@auth_router.post("/login", response_model=LoginResponse)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return access token."""
    
    ip_address, user_agent = get_client_info(request)
    
    logger.info(
        "Login attempt",
        email=login_data.email,
        ip_address=ip_address,
        remember_me=login_data.remember_me
    )
    
    # Authenticate user
    auth_service = AuthenticationService(db)
    user = await auth_service.authenticate_user(
        email=login_data.email,
        password=login_data.password,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Check if 2FA is enabled
    if user.two_factor_enabled:
        # Create temporary session for 2FA
        temp_token = SecurityManager.create_access_token(
            {"sub": str(user.id), "temp": True, "purpose": "2fa"},
            expires_delta=timedelta(minutes=10)
        )
        
        return LoginResponse(
            access_token=temp_token,
            refresh_token="",
            token_type="bearer",
            user=user.to_dict(),
            requires_2fa=True,
            redirect_url="/auth/2fa"
        )
    
    # Create tokens
    tokens = await auth_service.create_user_tokens(user)
    
    # Handle remember me
    if login_data.remember_me:
        remember_token = user.generate_remember_token()
        await db.commit()
        # In a real app, you'd set this as a secure HTTP-only cookie
    
    # Determine redirect URL based on user role
    redirect_url = user.role.default_dashboard if user.role else "/dashboard"
    
    logger.info(
        "User logged in successfully",
        user_id=user.id,
        email=user.email,
        role=user.role.name if user.role else None,
        ip_address=ip_address
    )
    
    return LoginResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        token_type=tokens["token_type"],
        user=user.to_dict(),
        requires_2fa=False,
        redirect_url=redirect_url
    )

@auth_router.post("/verify-2fa")
async def verify_two_factor(
    tfa_data: TwoFactorRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Verify 2FA code and complete login."""
    
    ip_address, user_agent = get_client_info(request)
    
    # Get user
    result = await db.execute(select(User).where(User.email == tfa_data.email))
    user = result.scalar_one_or_none()
    
    if not user or not user.two_factor_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="2FA not enabled for this user"
        )
    
    # Verify TOTP code
    if user.two_factor_secret:
        is_valid = TOTPManager.verify_totp(user.two_factor_secret, tfa_data.otp_code)
        
        if not is_valid:
            # Check backup codes
            is_valid = user.verify_backup_code(tfa_data.otp_code)
        
        if is_valid:
            # Create audit log
            audit_log = AuditLog.create_2fa_event(
                user_id=user.id,
                user_email=user.email,
                ip_address=ip_address,
                user_agent=user_agent,
                action="verified",
                success=True
            )
            db.add(audit_log)
            
            # Create tokens
            auth_service = AuthenticationService(db)
            tokens = await auth_service.create_user_tokens(user)
            
            await db.commit()
            
            redirect_url = user.role.default_dashboard if user.role else "/dashboard"
            
            return LoginResponse(
                access_token=tokens["access_token"],
                refresh_token=tokens["refresh_token"],
                token_type=tokens["token_type"],
                user=user.to_dict(),
                requires_2fa=False,
                redirect_url=redirect_url
            )
    
    # Failed 2FA
    audit_log = AuditLog.create_2fa_event(
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        action="failed",
        success=False
    )
    db.add(audit_log)
    await db.commit()
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid 2FA code"
    )

@auth_router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Logout user and invalidate tokens."""
    
    ip_address, user_agent = get_client_info(request)
    
    # Clear remember token
    current_user.clear_remember_token()
    
    # Create audit log
    audit_log = AuditLog.create_logout(
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(audit_log)
    
    await db.commit()
    
    logger.info(
        "User logged out",
        user_id=current_user.id,
        email=current_user.email,
        ip_address=ip_address
    )
    
    return {"message": "Successfully logged out"}

@auth_router.post("/refresh")
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    
    auth_service = AuthenticationService(db)
    tokens = await auth_service.refresh_access_token(refresh_data.refresh_token)
    
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    return tokens

@auth_router.post("/forgot-password")
async def forgot_password(
    reset_data: PasswordResetRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Send password reset email."""
    
    ip_address, user_agent = get_client_info(request)
    
    # Find user
    result = await db.execute(select(User).where(User.email == reset_data.email))
    user = result.scalar_one_or_none()
    
    # Always return success to prevent email enumeration
    if user and user.is_active:
        # Generate reset token
        reset_token = user.generate_password_reset_token()
        
        # Send email
        email_service = EmailService()
        await email_service.send_password_reset_email(
            email=user.email,
            name=user.full_name,
            reset_token=reset_token
        )
        
        # Create audit log
        audit_log = AuditLog(
            user_id=user.id,
            user_email=user.email,
            event_type='password_reset_requested',
            event_category='auth',
            action='password_reset_request',
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
        db.add(audit_log)
        
        await db.commit()
        
        logger.info(
            "Password reset requested",
            user_id=user.id,
            email=user.email,
            ip_address=ip_address
        )
    
    return {"message": "If the email exists, a password reset link has been sent"}

@auth_router.post("/reset-password")
async def reset_password(
    reset_data: PasswordResetConfirm,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Reset password using reset token."""
    
    ip_address, user_agent = get_client_info(request)
    
    # Find user with valid reset token
    result = await db.execute(
        select(User).where(User.password_reset_token == reset_data.token)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.verify_password_reset_token(reset_data.token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Set new password
    user.set_password(reset_data.new_password)
    user.clear_password_reset_token()
    
    # Reset failed login attempts
    user.reset_failed_login_attempts()
    
    # Create audit log
    audit_log = AuditLog.create_password_change(
        user_id=user.id,
        user_email=user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        success=True,
        method='reset'
    )
    db.add(audit_log)
    
    await db.commit()
    
    logger.info(
        "Password reset completed",
        user_id=user.id,
        email=user.email,
        ip_address=ip_address
    )
    
    return {"message": "Password has been reset successfully"}

@auth_router.post("/change-password")
async def change_password(
    password_data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password."""
    
    ip_address, user_agent = get_client_info(request)
    
    # Verify current password
    if not current_user.verify_password(password_data.current_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Set new password
    current_user.set_password(password_data.new_password)
    
    # Create audit log
    audit_log = AuditLog.create_password_change(
        user_id=current_user.id,
        user_email=current_user.email,
        ip_address=ip_address,
        user_agent=user_agent,
        success=True,
        method='manual'
    )
    db.add(audit_log)
    
    await db.commit()
    
    logger.info(
        "Password changed",
        user_id=current_user.id,
        email=current_user.email,
        ip_address=ip_address
    )
    
    return {"message": "Password changed successfully"}

@auth_router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user information."""
    return current_user.to_dict()

@auth_router.get("/health")
async def auth_health_check():
    """Health check for authentication service."""
    return {
        "status": "healthy",
        "service": "authentication",
        "timestamp": datetime.utcnow().isoformat()
    }

