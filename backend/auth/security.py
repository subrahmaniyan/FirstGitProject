"""
Security utilities for authentication and authorization.
"""

from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import secrets
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import get_settings
from database import get_db
from models.user import User
from models.audit_log import AuditLog

logger = structlog.get_logger()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT token security
security = HTTPBearer()

settings = get_settings()

class SecurityManager:
    """Centralized security management."""
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return pwd_context.verify(plain_password, hashed_password)
    
    @staticmethod
    def get_password_hash(password: str) -> str:
        """Hash a password."""
        return pwd_context.hash(password)
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token."""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({"exp": expire, "type": "access"})
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
        return encoded_jwt
    
    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        """Create JWT refresh token."""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        to_encode.update({"exp": expire, "type": "refresh"})
        
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
        return encoded_jwt
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[Dict[str, Any]]:
        """Verify and decode JWT token."""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            
            # Verify token type
            if payload.get("type") != token_type:
                return None
            
            # Check expiration
            exp = payload.get("exp")
            if exp and datetime.utcnow() > datetime.fromtimestamp(exp):
                return None
            
            return payload
            
        except JWTError as e:
            logger.warning("JWT verification failed", error=str(e))
            return None
    
    @staticmethod
    def generate_csrf_token() -> str:
        """Generate CSRF token."""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def verify_csrf_token(token: str, expected_token: str) -> bool:
        """Verify CSRF token."""
        return secrets.compare_digest(token, expected_token)


class AuthenticationService:
    """Authentication service with comprehensive security features."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def authenticate_user(
        self,
        email: str,
        password: str,
        ip_address: str,
        user_agent: str
    ) -> Optional[User]:
        """Authenticate user with comprehensive security checks."""
        
        # Find user by email
        from sqlalchemy import select
        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        # Create audit log for login attempt
        audit_log = AuditLog.create_login_attempt(
            user_id=user.id if user else None,
            user_email=email,
            ip_address=ip_address,
            user_agent=user_agent,
            success=False  # Will be updated if successful
        )
        
        try:
            # Check if user exists
            if not user:
                audit_log.error_message = "User not found"
                self.db.add(audit_log)
                await self.db.commit()
                return None
            
            # Check if account is active
            if not user.is_active:
                audit_log.error_message = "Account is inactive"
                audit_log.user_id = user.id
                self.db.add(audit_log)
                await self.db.commit()
                return None
            
            # Check if account is locked
            if user.is_account_locked():
                audit_log.error_message = "Account is locked"
                audit_log.user_id = user.id
                self.db.add(audit_log)
                await self.db.commit()
                
                # Create account locked audit log
                locked_log = AuditLog.create_account_locked(
                    user_id=user.id,
                    user_email=user.email,
                    ip_address=ip_address,
                    user_agent=user_agent
                )
                self.db.add(locked_log)
                await self.db.commit()
                return None
            
            # Verify password
            if not user.verify_password(password):
                # Increment failed login attempts
                user.increment_failed_login()
                
                audit_log.error_message = "Invalid password"
                audit_log.user_id = user.id
                self.db.add(audit_log)
                
                # Check if account should be locked
                if user.is_account_locked():
                    locked_log = AuditLog.create_account_locked(
                        user_id=user.id,
                        user_email=user.email,
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                    self.db.add(locked_log)
                
                await self.db.commit()
                return None
            
            # Successful authentication
            user.reset_failed_login_attempts()
            
            # Update audit log
            audit_log.success = True
            audit_log.error_message = None
            audit_log.user_id = user.id
            self.db.add(audit_log)
            
            await self.db.commit()
            
            logger.info(
                "User authenticated successfully",
                user_id=user.id,
                email=user.email,
                ip_address=ip_address
            )
            
            return user
            
        except Exception as e:
            logger.error(
                "Authentication error",
                error=str(e),
                email=email,
                ip_address=ip_address,
                exc_info=True
            )
            
            audit_log.error_message = "Authentication system error"
            if user:
                audit_log.user_id = user.id
            self.db.add(audit_log)
            await self.db.commit()
            
            return None
    
    async def create_user_tokens(self, user: User) -> Dict[str, str]:
        """Create access and refresh tokens for user."""
        token_data = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role.name if user.role else "guest"
        }
        
        access_token = SecurityManager.create_access_token(token_data)
        refresh_token = SecurityManager.create_refresh_token(token_data)
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer"
        }
    
    async def refresh_access_token(self, refresh_token: str) -> Optional[Dict[str, str]]:
        """Refresh access token using refresh token."""
        payload = SecurityManager.verify_token(refresh_token, "refresh")
        
        if not payload:
            return None
        
        # Get user to ensure they still exist and are active
        user_id = payload.get("sub")
        if not user_id:
            return None
        
        from sqlalchemy import select
        result = await self.db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        
        if not user or not user.is_active:
            return None
        
        # Create new tokens
        return await self.create_user_tokens(user)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Verify token
        payload = SecurityManager.verify_token(credentials.credentials)
        if not payload:
            raise credentials_exception
        
        # Get user ID from token
        user_id = payload.get("sub")
        if not user_id:
            raise credentials_exception
        
        # Get user from database
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        
        if not user:
            raise credentials_exception
        
        # Check if user is still active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is inactive"
            )
        
        # Check if account is locked
        if user.is_account_locked():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is locked"
            )
        
        return user
        
    except JWTError:
        raise credentials_exception
    except Exception as e:
        logger.error("Error getting current user", error=str(e), exc_info=True)
        raise credentials_exception


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user (additional check)."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


def require_permission(permission: str):
    """Decorator to require specific permission."""
    def permission_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not current_user.role or not current_user.role.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission required: {permission}"
            )
        return current_user
    
    return permission_checker


def require_role(role_name: str):
    """Decorator to require specific role."""
    def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not current_user.role or current_user.role.name != role_name:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role required: {role_name}"
            )
        return current_user
    
    return role_checker

