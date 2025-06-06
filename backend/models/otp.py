"""
OTP (One-Time Password) model for two-factor authentication.
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from typing import Optional
import secrets
import hashlib
import hmac
import base64
import struct
import time

from database import Base


class OTP(Base):
    """OTP model for two-factor authentication and password reset."""
    
    __tablename__ = "otps"
    
    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # OTP details
    code_hash = Column(String(255), nullable=False)  # Hashed OTP code
    otp_type = Column(String(20), nullable=False)  # email, sms, totp
    purpose = Column(String(30), nullable=False)  # login, password_reset, account_verification
    
    # Delivery information
    delivery_method = Column(String(20), nullable=False)  # email, sms
    delivery_address = Column(String(255), nullable=False)  # email address or phone number
    
    # Status and validation
    is_used = Column(Boolean, default=False, nullable=False)
    attempts = Column(Integer, default=0, nullable=False)
    max_attempts = Column(Integer, default=3, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    
    # Security fields
    ip_address = Column(String(45), nullable=False)  # IP that requested the OTP
    user_agent = Column(String(500), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="otps")
    
    # Indexes
    __table_args__ = (
        Index('idx_otp_user_type', 'user_id', 'otp_type'),
        Index('idx_otp_expires', 'expires_at'),
        Index('idx_otp_used', 'is_used'),
    )
    
    @classmethod
    def generate_code(cls, length: int = 6) -> str:
        """Generate a random OTP code."""
        # Generate numeric code
        code = ''.join([str(secrets.randbelow(10)) for _ in range(length)])
        return code
    
    @classmethod
    def hash_code(cls, code: str) -> str:
        """Hash an OTP code for secure storage."""
        return hashlib.sha256(code.encode()).hexdigest()
    
    def verify_code(self, code: str) -> bool:
        """Verify an OTP code."""
        # Check if OTP is still valid
        if self.is_expired() or self.is_used or self.attempts >= self.max_attempts:
            return False
        
        # Increment attempts
        self.attempts += 1
        
        # Verify the code
        code_hash = self.hash_code(code)
        if hmac.compare_digest(self.code_hash, code_hash):
            self.is_used = True
            self.used_at = datetime.utcnow()
            return True
        
        return False
    
    def is_expired(self) -> bool:
        """Check if OTP has expired."""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """Check if OTP is valid for use."""
        return not self.is_expired() and not self.is_used and self.attempts < self.max_attempts
    
    @classmethod
    def create_email_otp(
        cls,
        user_id: int,
        email: str,
        purpose: str,
        ip_address: str,
        user_agent: Optional[str] = None,
        expire_minutes: int = 5
    ) -> tuple['OTP', str]:
        """Create an email OTP."""
        code = cls.generate_code(6)
        code_hash = cls.hash_code(code)
        
        otp = cls(
            user_id=user_id,
            code_hash=code_hash,
            otp_type='email',
            purpose=purpose,
            delivery_method='email',
            delivery_address=email,
            expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return otp, code
    
    @classmethod
    def create_sms_otp(
        cls,
        user_id: int,
        phone_number: str,
        purpose: str,
        ip_address: str,
        user_agent: Optional[str] = None,
        expire_minutes: int = 5
    ) -> tuple['OTP', str]:
        """Create an SMS OTP."""
        code = cls.generate_code(6)
        code_hash = cls.hash_code(code)
        
        otp = cls(
            user_id=user_id,
            code_hash=code_hash,
            otp_type='sms',
            purpose=purpose,
            delivery_method='sms',
            delivery_address=phone_number,
            expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return otp, code
    
    @classmethod
    def create_totp_verification(
        cls,
        user_id: int,
        purpose: str,
        ip_address: str,
        user_agent: Optional[str] = None,
        expire_minutes: int = 2
    ) -> 'OTP':
        """Create a TOTP verification record (no code generated)."""
        otp = cls(
            user_id=user_id,
            code_hash='',  # TOTP codes are verified differently
            otp_type='totp',
            purpose=purpose,
            delivery_method='app',
            delivery_address='authenticator_app',
            expires_at=datetime.utcnow() + timedelta(minutes=expire_minutes),
            ip_address=ip_address,
            user_agent=user_agent
        )
        
        return otp
    
    def to_dict(self, include_sensitive: bool = False) -> dict:
        """Convert OTP to dictionary."""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "otp_type": self.otp_type,
            "purpose": self.purpose,
            "delivery_method": self.delivery_method,
            "delivery_address": self.delivery_address,
            "is_used": self.is_used,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat(),
            "used_at": self.used_at.isoformat() if self.used_at else None,
            "is_expired": self.is_expired(),
            "is_valid": self.is_valid()
        }
        
        if include_sensitive:
            data.update({
                "ip_address": self.ip_address,
                "user_agent": self.user_agent
            })
        
        return data
    
    def __repr__(self) -> str:
        return f"<OTP(id={self.id}, user_id={self.user_id}, type='{self.otp_type}', purpose='{self.purpose}')>"


class TOTPManager:
    """TOTP (Time-based One-Time Password) manager for authenticator apps."""
    
    @staticmethod
    def generate_secret() -> str:
        """Generate a new TOTP secret."""
        return base64.b32encode(secrets.token_bytes(20)).decode('utf-8')
    
    @staticmethod
    def generate_qr_code_url(secret: str, user_email: str, issuer: str = "LMS") -> str:
        """Generate QR code URL for TOTP setup."""
        from urllib.parse import quote
        
        label = f"{issuer}:{user_email}"
        params = f"secret={secret}&issuer={quote(issuer)}"
        return f"otpauth://totp/{quote(label)}?{params}"
    
    @staticmethod
    def verify_totp(secret: str, token: str, window: int = 1) -> bool:
        """Verify a TOTP token with time window tolerance."""
        if not secret or not token:
            return False
        
        try:
            # Convert token to integer
            token_int = int(token)
        except ValueError:
            return False
        
        # Get current time step
        current_time = int(time.time()) // 30
        
        # Check current time step and adjacent ones (for clock skew tolerance)
        for i in range(-window, window + 1):
            time_step = current_time + i
            expected_token = TOTPManager._generate_totp_token(secret, time_step)
            
            if hmac.compare_digest(str(expected_token), str(token_int)):
                return True
        
        return False
    
    @staticmethod
    def _generate_totp_token(secret: str, time_step: int) -> int:
        """Generate TOTP token for a specific time step."""
        # Decode base32 secret
        key = base64.b32decode(secret.upper())
        
        # Convert time step to bytes
        time_bytes = struct.pack('>Q', time_step)
        
        # Generate HMAC
        hmac_digest = hmac.new(key, time_bytes, hashlib.sha1).digest()
        
        # Dynamic truncation
        offset = hmac_digest[-1] & 0x0f
        truncated = struct.unpack('>I', hmac_digest[offset:offset + 4])[0]
        truncated &= 0x7fffffff
        
        # Generate 6-digit token
        token = truncated % 1000000
        return token

