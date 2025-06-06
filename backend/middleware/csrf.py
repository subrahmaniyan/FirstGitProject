"""
CSRF protection middleware for the LMS application.
"""

from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import secrets
import structlog
from typing import Set

logger = structlog.get_logger()

class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.exempt_paths: Set[str] = {
            "/health",
            "/api/health",
            "/api/auth/login",  # Initial login doesn't need CSRF
            "/api/docs",
            "/api/redoc",
            "/api/openapi.json"
        }
        self.safe_methods = {"GET", "HEAD", "OPTIONS", "TRACE"}
    
    def generate_csrf_token(self) -> str:
        """Generate a new CSRF token."""
        return secrets.token_urlsafe(32)
    
    def get_csrf_token_from_request(self, request: Request) -> str:
        """Extract CSRF token from request headers or form data."""
        # Check X-CSRF-Token header first
        csrf_token = request.headers.get("X-CSRF-Token")
        
        if not csrf_token:
            # Check X-CSRFToken header (alternative name)
            csrf_token = request.headers.get("X-CSRFToken")
        
        return csrf_token or ""
    
    def is_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from CSRF protection."""
        return path in self.exempt_paths or path.startswith("/static/")
    
    async def dispatch(self, request: Request, call_next):
        """Apply CSRF protection to unsafe methods."""
        
        # Skip CSRF for safe methods
        if request.method in self.safe_methods:
            response = await call_next(request)
            # Add CSRF token to response for safe methods
            if not self.is_exempt_path(request.url.path):
                csrf_token = self.generate_csrf_token()
                response.headers["X-CSRF-Token"] = csrf_token
            return response
        
        # Skip CSRF for exempt paths
        if self.is_exempt_path(request.url.path):
            return await call_next(request)
        
        # For unsafe methods, verify CSRF token
        csrf_token = self.get_csrf_token_from_request(request)
        
        if not csrf_token:
            logger.warning(
                "CSRF token missing",
                method=request.method,
                path=request.url.path,
                client_ip=request.client.host if request.client else "unknown"
            )
            
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "CSRF token missing"}
            )
        
        # In a production environment, you would validate the token
        # against a stored value (e.g., in session or database)
        # For this example, we'll accept any non-empty token
        if len(csrf_token) < 16:
            logger.warning(
                "Invalid CSRF token",
                method=request.method,
                path=request.url.path,
                client_ip=request.client.host if request.client else "unknown"
            )
            
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Invalid CSRF token"}
            )
        
        # Process request
        response = await call_next(request)
        
        # Add new CSRF token to response
        new_csrf_token = self.generate_csrf_token()
        response.headers["X-CSRF-Token"] = new_csrf_token
        
        return response

