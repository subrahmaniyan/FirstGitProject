"""
User model with comprehensive security features and role-based access control.
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from typing import Optional, List
import bcrypt
import secrets

from database import Base


class User(Base):
    """User model with security features and audit trail."""
    
    __tablename__ = "users"
    
    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=True)  # Nullable for SSO-only users
    
    # Profile information
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone_number = Column(String(20), nullable=True)
    profile_picture_url = Column(String(500), nullable=True)
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_locked = Column(Boolean, default=False, nullable=False)
    
    # Security fields
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime, nullable=True)
    last_login = Column(DateTime, nullable=True)
    last_password_change = Column(DateTime, default=func.now(), nullable=False)
    password_reset_token = Column(String(255), nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    
    # 2FA fields
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    two_factor_secret = Column(String(255), nullable=True)
    backup_codes = Column(Text, nullable=True)  # JSON string of backup codes
    
    # SSO fields
    google_id = Column(String(255), nullable=True, unique=True)
    microsoft_id = Column(String(255), nullable=True, unique=True)
    
    # Session management
    remember_token = Column(String(255), nullable=True)
    remember_token_expires = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user")
    otps = relationship("OTP", back_populates="user")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_user_email_active', 'email', 'is_active'),
        Index('idx_user_role_active', 'role_id', 'is_active'),
        Index('idx_user_last_login', 'last_login'),
        Index('idx_user_locked_until', 'locked_until'),
    )
    
    def set_password(self, password: str) -> None:
        """Hash and set user password."""
        salt = bcrypt.gensalt()
        self.hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
        self.last_password_change = datetime.utcnow()
    
    def verify_password(self, password: str) -> bool:
        """Verify user password."""
        if not self.hashed_password:
            return False
        return bcrypt.checkpw(password.encode('utf-8'), self.hashed_password.encode('utf-8'))
    
    def generate_password_reset_token(self) -> str:
        """Generate secure password reset token."""
        token = secrets.token_urlsafe(32)
        self.password_reset_token = token
        self.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        return token
    
    def verify_password_reset_token(self, token: str) -> bool:
        """Verify password reset token."""
        if not self.password_reset_token or not self.password_reset_expires:
            return False
        
        if datetime.utcnow() > self.password_reset_expires:
            return False
        
        return secrets.compare_digest(self.password_reset_token, token)
    
    def clear_password_reset_token(self) -> None:
        """Clear password reset token after use."""
        self.password_reset_token = None
        self.password_reset_expires = None
    
    def increment_failed_login(self) -> None:
        """Increment failed login attempts and lock account if necessary."""
        self.failed_login_attempts += 1
        
        # Lock account after 5 failed attempts
        if self.failed_login_attempts >= 5:
            self.is_locked = True
            self.locked_until = datetime.utcnow() + timedelta(minutes=30)
    
    def reset_failed_login_attempts(self) -> None:
        """Reset failed login attempts after successful login."""
        self.failed_login_attempts = 0
        self.is_locked = False
        self.locked_until = None
        self.last_login = datetime.utcnow()
    
    def is_account_locked(self) -> bool:
        """Check if account is currently locked."""
        if not self.is_locked:
            return False
        
        if self.locked_until and datetime.utcnow() > self.locked_until:
            # Auto-unlock expired locks
            self.is_locked = False
            self.locked_until = None
            return False
        
        return True
    
    def generate_remember_token(self) -> str:
        """Generate remember me token."""
        token = secrets.token_urlsafe(32)
        self.remember_token = token
        self.remember_token_expires = datetime.utcnow() + timedelta(days=30)
        return token
    
    def verify_remember_token(self, token: str) -> bool:
        """Verify remember me token."""
        if not self.remember_token or not self.remember_token_expires:
            return False
        
        if datetime.utcnow() > self.remember_token_expires:
            return False
        
        return secrets.compare_digest(self.remember_token, token)
    
    def clear_remember_token(self) -> None:
        """Clear remember me token."""
        self.remember_token = None
        self.remember_token_expires = None
    
    def enable_two_factor(self, secret: str) -> None:
        """Enable two-factor authentication."""
        self.two_factor_enabled = True
        self.two_factor_secret = secret
        self.generate_backup_codes()
    
    def disable_two_factor(self) -> None:
        """Disable two-factor authentication."""
        self.two_factor_enabled = False
        self.two_factor_secret = None
        self.backup_codes = None
    
    def generate_backup_codes(self) -> List[str]:
        """Generate backup codes for 2FA recovery."""
        import json
        codes = [secrets.token_hex(4).upper() for _ in range(10)]
        self.backup_codes = json.dumps(codes)
        return codes
    
    def verify_backup_code(self, code: str) -> bool:
        """Verify and consume a backup code."""
        if not self.backup_codes:
            return False
        
        import json
        codes = json.loads(self.backup_codes)
        
        if code.upper() in codes:
            codes.remove(code.upper())
            self.backup_codes = json.dumps(codes)
            return True
        
        return False
    
    @property
    def full_name(self) -> str:
        """Get user's full name."""
        return f"{self.first_name} {self.last_name}"
    
    @property
    def display_name(self) -> str:
        """Get user's display name."""
        return self.username or self.full_name
    
    @property
    def is_password_expired(self) -> bool:
        """Check if password needs to be changed (90 days)."""
        if not self.last_password_change:
            return True
        
        expiry_date = self.last_password_change + timedelta(days=90)
        return datetime.utcnow() > expiry_date
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert user to dictionary."""
        data = {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "display_name": self.display_name,
            "phone_number": self.phone_number,
            "profile_picture_url": self.profile_picture_url,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "two_factor_enabled": self.two_factor_enabled,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "created_at": self.created_at.isoformat(),
            "role": self.role.to_dict() if self.role else None
        }
        
        if include_sensitive:
            data.update({
                "is_locked": self.is_locked,
                "failed_login_attempts": self.failed_login_attempts,
                "locked_until": self.locked_until.isoformat() if self.locked_until else None,
                "is_password_expired": self.is_password_expired
            })
        
        return data
    
    def __repr__(self) -> str:
        return f"<User(id={self.id}, email='{self.email}', role='{self.role.name if self.role else None}')>"

