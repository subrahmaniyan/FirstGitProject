"""
Role model for role-based access control (RBAC).
"""

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from typing import List, Dict
import json

from database import Base


class Role(Base):
    """Role model for user access control."""
    
    __tablename__ = "roles"
    
    # Primary fields
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Role properties
    is_active = Column(Boolean, default=True, nullable=False)
    is_system_role = Column(Boolean, default=False, nullable=False)  # Cannot be deleted
    
    # Permissions (stored as JSON)
    permissions = Column(Text, nullable=False, default='[]')  # JSON array of permission strings
    
    # Dashboard configuration
    default_dashboard = Column(String(100), nullable=False)  # Route to redirect after login
    
    # Timestamps
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="role")
    
    # Indexes
    __table_args__ = (
        Index('idx_role_name_active', 'name', 'is_active'),
    )
    
    def get_permissions(self) -> List[str]:
        """Get role permissions as a list."""
        try:
            return json.loads(self.permissions) if self.permissions else []
        except json.JSONDecodeError:
            return []
    
    def set_permissions(self, permissions: List[str]) -> None:
        """Set role permissions from a list."""
        self.permissions = json.dumps(permissions)
    
    def has_permission(self, permission: str) -> bool:
        """Check if role has a specific permission."""
        return permission in self.get_permissions()
    
    def add_permission(self, permission: str) -> None:
        """Add a permission to the role."""
        current_permissions = self.get_permissions()
        if permission not in current_permissions:
            current_permissions.append(permission)
            self.set_permissions(current_permissions)
    
    def remove_permission(self, permission: str) -> None:
        """Remove a permission from the role."""
        current_permissions = self.get_permissions()
        if permission in current_permissions:
            current_permissions.remove(permission)
            self.set_permissions(current_permissions)
    
    def to_dict(self) -> Dict:
        """Convert role to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "display_name": self.display_name,
            "description": self.description,
            "is_active": self.is_active,
            "is_system_role": self.is_system_role,
            "permissions": self.get_permissions(),
            "default_dashboard": self.default_dashboard,
            "created_at": self.created_at.isoformat(),
            "user_count": len(self.users) if self.users else 0
        }
    
    @classmethod
    def create_default_roles(cls) -> List['Role']:
        """Create default system roles."""
        default_roles = [
            {
                "name": "student",
                "display_name": "Student",
                "description": "Standard student access with course enrollment and assignment submission",
                "is_system_role": True,
                "default_dashboard": "/dashboard/student",
                "permissions": [
                    "course.view",
                    "course.enroll",
                    "assignment.view",
                    "assignment.submit",
                    "grade.view_own",
                    "discussion.participate",
                    "profile.edit_own",
                    "notification.view_own"
                ]
            },
            {
                "name": "instructor",
                "display_name": "Instructor",
                "description": "Instructor access with course management and grading capabilities",
                "is_system_role": True,
                "default_dashboard": "/dashboard/instructor",
                "permissions": [
                    "course.view",
                    "course.create",
                    "course.edit_own",
                    "course.manage_enrollment",
                    "assignment.view",
                    "assignment.create",
                    "assignment.edit_own",
                    "assignment.grade",
                    "grade.view_all",
                    "grade.edit",
                    "discussion.moderate",
                    "student.view_enrolled",
                    "analytics.view_course",
                    "profile.edit_own",
                    "notification.view_own"
                ]
            },
            {
                "name": "admin",
                "display_name": "Administrator",
                "description": "Full system access with user and system management capabilities",
                "is_system_role": True,
                "default_dashboard": "/dashboard/admin",
                "permissions": [
                    "user.view_all",
                    "user.create",
                    "user.edit",
                    "user.delete",
                    "user.manage_roles",
                    "course.view_all",
                    "course.create",
                    "course.edit_all",
                    "course.delete",
                    "assignment.view_all",
                    "assignment.edit_all",
                    "assignment.delete",
                    "grade.view_all",
                    "grade.edit_all",
                    "role.view",
                    "role.create",
                    "role.edit",
                    "role.delete",
                    "system.configure",
                    "system.backup",
                    "analytics.view_all",
                    "audit.view",
                    "notification.send_all",
                    "profile.edit_all"
                ]
            },
            {
                "name": "guest",
                "display_name": "Guest",
                "description": "Limited access for unregistered users",
                "is_system_role": True,
                "default_dashboard": "/dashboard/guest",
                "permissions": [
                    "course.view_public",
                    "content.view_public"
                ]
            }
        ]
        
        roles = []
        for role_data in default_roles:
            role = cls(
                name=role_data["name"],
                display_name=role_data["display_name"],
                description=role_data["description"],
                is_system_role=role_data["is_system_role"],
                default_dashboard=role_data["default_dashboard"]
            )
            role.set_permissions(role_data["permissions"])
            roles.append(role)
        
        return roles
    
    def __repr__(self) -> str:
        return f"<Role(id={self.id}, name='{self.name}', users={len(self.users) if self.users else 0})>"


# Permission constants for easy reference
class Permissions:
    """Centralized permission definitions."""
    
    # User permissions
    USER_VIEW_ALL = "user.view_all"
    USER_CREATE = "user.create"
    USER_EDIT = "user.edit"
    USER_DELETE = "user.delete"
    USER_MANAGE_ROLES = "user.manage_roles"
    
    # Course permissions
    COURSE_VIEW = "course.view"
    COURSE_VIEW_ALL = "course.view_all"
    COURSE_VIEW_PUBLIC = "course.view_public"
    COURSE_CREATE = "course.create"
    COURSE_EDIT_OWN = "course.edit_own"
    COURSE_EDIT_ALL = "course.edit_all"
    COURSE_DELETE = "course.delete"
    COURSE_ENROLL = "course.enroll"
    COURSE_MANAGE_ENROLLMENT = "course.manage_enrollment"
    
    # Assignment permissions
    ASSIGNMENT_VIEW = "assignment.view"
    ASSIGNMENT_VIEW_ALL = "assignment.view_all"
    ASSIGNMENT_CREATE = "assignment.create"
    ASSIGNMENT_EDIT_OWN = "assignment.edit_own"
    ASSIGNMENT_EDIT_ALL = "assignment.edit_all"
    ASSIGNMENT_DELETE = "assignment.delete"
    ASSIGNMENT_SUBMIT = "assignment.submit"
    ASSIGNMENT_GRADE = "assignment.grade"
    
    # Grade permissions
    GRADE_VIEW_OWN = "grade.view_own"
    GRADE_VIEW_ALL = "grade.view_all"
    GRADE_EDIT = "grade.edit"
    GRADE_EDIT_ALL = "grade.edit_all"
    
    # Discussion permissions
    DISCUSSION_PARTICIPATE = "discussion.participate"
    DISCUSSION_MODERATE = "discussion.moderate"
    
    # Student permissions
    STUDENT_VIEW_ENROLLED = "student.view_enrolled"
    
    # Analytics permissions
    ANALYTICS_VIEW_COURSE = "analytics.view_course"
    ANALYTICS_VIEW_ALL = "analytics.view_all"
    
    # System permissions
    SYSTEM_CONFIGURE = "system.configure"
    SYSTEM_BACKUP = "system.backup"
    
    # Role permissions
    ROLE_VIEW = "role.view"
    ROLE_CREATE = "role.create"
    ROLE_EDIT = "role.edit"
    ROLE_DELETE = "role.delete"
    
    # Audit permissions
    AUDIT_VIEW = "audit.view"
    
    # Profile permissions
    PROFILE_EDIT_OWN = "profile.edit_own"
    PROFILE_EDIT_ALL = "profile.edit_all"
    
    # Notification permissions
    NOTIFICATION_VIEW_OWN = "notification.view_own"
    NOTIFICATION_SEND_ALL = "notification.send_all"
    
    # Content permissions
    CONTENT_VIEW_PUBLIC = "content.view_public"

