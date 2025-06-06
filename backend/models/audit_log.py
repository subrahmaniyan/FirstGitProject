"""
Audit log model for comprehensive security and activity tracking.
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from typing import Dict, Optional, Any
import json

from database import Base


class AuditLog(Base):
    """Audit log model for tracking all user activities and security events."""
    
    __tablename__ = "audit_logs"
    
    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    
    # User information
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for anonymous events
    user_email = Column(String(255), nullable=True)  # Store email for deleted users
    
    # Event information
    event_type = Column(String(50), nullable=False, index=True)  # login, logout, password_change, etc.
    event_category = Column(String(30), nullable=False, index=True)  # auth, user, course, system
    action = Column(String(100), nullable=False)  # Specific action taken
    resource = Column(String(100), nullable=True)  # Resource affected (user, course, etc.)
    resource_id = Column(String(50), nullable=True)  # ID of the affected resource
    
    # Request information
    ip_address = Column(String(45), nullable=False, index=True)  # IPv4 or IPv6
    user_agent = Column(Text, nullable=True)
    request_method = Column(String(10), nullable=True)  # GET, POST, etc.
    request_path = Column(String(500), nullable=True)
    request_id = Column(String(100), nullable=True)  # For request correlation
    
    # Event details
    success = Column(Boolean, nullable=False, default=True)
    error_message = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # JSON string with additional details
    
    # Security fields
    risk_score = Column(Integer, default=0, nullable=False)  # 0-100 risk assessment
    flagged = Column(Boolean, default=False, nullable=False)  # Flagged for review
    
    # Geolocation (optional)
    country = Column(String(2), nullable=True)  # ISO country code
    region = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=func.now(), nullable=False, index=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_audit_user_event', 'user_id', 'event_type'),
        Index('idx_audit_ip_time', 'ip_address', 'created_at'),
        Index('idx_audit_category_time', 'event_category', 'created_at'),
        Index('idx_audit_success_time', 'success', 'created_at'),
        Index('idx_audit_flagged', 'flagged'),
        Index('idx_audit_risk_score', 'risk_score'),
    )
    
    def set_details(self, details: Dict[str, Any]) -> None:
        """Set event details as JSON."""
        self.details = json.dumps(details, default=str)
    
    def get_details(self) -> Dict[str, Any]:
        """Get event details from JSON."""
        try:
            return json.loads(self.details) if self.details else {}
        except json.JSONDecodeError:
            return {}
    
    def calculate_risk_score(self) -> int:
        """Calculate risk score based on event characteristics."""
        score = 0
        
        # Base scores by event type
        high_risk_events = ['login_failed', 'password_reset_requested', 'account_locked', 'suspicious_activity']
        medium_risk_events = ['login_success', 'password_changed', 'profile_updated']
        
        if self.event_type in high_risk_events:
            score += 30
        elif self.event_type in medium_risk_events:
            score += 10
        
        # Failed events are riskier
        if not self.success:
            score += 20
        
        # Multiple failed attempts from same IP
        # This would require a database query, so we'll keep it simple for now
        
        # Unusual hours (this would need timezone handling)
        hour = self.created_at.hour
        if hour < 6 or hour > 22:  # Outside normal business hours
            score += 5
        
        # Cap at 100
        self.risk_score = min(score, 100)
        return self.risk_score
    
    def flag_for_review(self, reason: str = None) -> None:
        """Flag this log entry for manual review."""
        self.flagged = True
        if reason:
            details = self.get_details()
            details['flag_reason'] = reason
            self.set_details(details)
    
    @classmethod
    def create_login_attempt(
        cls,
        user_id: Optional[int],
        user_email: str,
        ip_address: str,
        user_agent: str,
        success: bool,
        error_message: Optional[str] = None,
        additional_details: Optional[Dict] = None
    ) -> 'AuditLog':
        """Create a login attempt audit log."""
        log = cls(
            user_id=user_id,
            user_email=user_email,
            event_type='login_success' if success else 'login_failed',
            event_category='auth',
            action='login_attempt',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message
        )
        
        if additional_details:
            log.set_details(additional_details)
        
        log.calculate_risk_score()
        return log
    
    @classmethod
    def create_logout(
        cls,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str
    ) -> 'AuditLog':
        """Create a logout audit log."""
        return cls(
            user_id=user_id,
            user_email=user_email,
            event_type='logout',
            event_category='auth',
            action='logout',
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
    
    @classmethod
    def create_password_change(
        cls,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str,
        success: bool,
        method: str = 'manual'  # manual, reset, forced
    ) -> 'AuditLog':
        """Create a password change audit log."""
        log = cls(
            user_id=user_id,
            user_email=user_email,
            event_type='password_changed',
            event_category='auth',
            action='password_change',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success
        )
        
        log.set_details({'method': method})
        log.calculate_risk_score()
        return log
    
    @classmethod
    def create_account_locked(
        cls,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str,
        reason: str = 'failed_login_attempts'
    ) -> 'AuditLog':
        """Create an account locked audit log."""
        log = cls(
            user_id=user_id,
            user_email=user_email,
            event_type='account_locked',
            event_category='security',
            action='account_lock',
            ip_address=ip_address,
            user_agent=user_agent,
            success=True
        )
        
        log.set_details({'reason': reason})
        log.calculate_risk_score()
        log.flag_for_review('Account automatically locked')
        return log
    
    @classmethod
    def create_2fa_event(
        cls,
        user_id: int,
        user_email: str,
        ip_address: str,
        user_agent: str,
        action: str,  # enabled, disabled, verified, failed
        success: bool
    ) -> 'AuditLog':
        """Create a 2FA-related audit log."""
        log = cls(
            user_id=user_id,
            user_email=user_email,
            event_type=f'2fa_{action}',
            event_category='security',
            action=f'2fa_{action}',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success
        )
        
        log.calculate_risk_score()
        return log
    
    @classmethod
    def create_sso_event(
        cls,
        user_id: Optional[int],
        user_email: str,
        ip_address: str,
        user_agent: str,
        provider: str,  # google, microsoft, etc.
        success: bool,
        error_message: Optional[str] = None
    ) -> 'AuditLog':
        """Create an SSO authentication audit log."""
        log = cls(
            user_id=user_id,
            user_email=user_email,
            event_type='sso_login_success' if success else 'sso_login_failed',
            event_category='auth',
            action='sso_login',
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=error_message
        )
        
        log.set_details({'provider': provider})
        log.calculate_risk_score()
        return log
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert audit log to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "user_email": self.user_email,
            "event_type": self.event_type,
            "event_category": self.event_category,
            "action": self.action,
            "resource": self.resource,
            "resource_id": self.resource_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "request_method": self.request_method,
            "request_path": self.request_path,
            "success": self.success,
            "error_message": self.error_message,
            "details": self.get_details(),
            "risk_score": self.risk_score,
            "flagged": self.flagged,
            "country": self.country,
            "region": self.region,
            "city": self.city,
            "created_at": self.created_at.isoformat()
        }
    
    def __repr__(self) -> str:
        return f"<AuditLog(id={self.id}, event='{self.event_type}', user='{self.user_email}', success={self.success})>"

