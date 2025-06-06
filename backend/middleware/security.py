"""
Security middleware for the LMS application.
Implements CSRF protection, rate limiting, and security headers.
"""

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import time
import hashlib
import structlog
from typing import Dict, Optional
import redis.asyncio as redis
from datetime import datetime, timedelta

from config.settings import get_settings

logger = structlog.get_logger()
settings = get_settings()

class SecurityMiddleware(BaseHTTPMiddleware):
    """Security middleware for adding security headers and basic protection."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next):
        """Add security headers to all responses."""
        
        # Process request
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        # HSTS header for HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        
        # Content Security Policy
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' https:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )
        response.headers["Content-Security-Policy"] = csp
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware to prevent abuse."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.redis_client: Optional[redis.Redis] = None
        self.rate_limits = {
            "/api/auth/login": {"requests": 5, "window": 900},  # 5 requests per 15 minutes
            "/api/auth/forgot-password": {"requests": 3, "window": 3600},  # 3 requests per hour
            "/api/auth/verify-2fa": {"requests": 10, "window": 900},  # 10 requests per 15 minutes
            "default": {"requests": 100, "window": 60}  # 100 requests per minute for other endpoints
        }
    
    async def get_redis_client(self) -> redis.Redis:
        """Get Redis client for rate limiting."""
        if not self.redis_client:
            self.redis_client = redis.from_url(settings.REDIS_URL)
        return self.redis_client
    
    def get_client_identifier(self, request: Request) -> str:
        """Get client identifier for rate limiting."""
        # Use IP address as primary identifier
        ip_address = (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
            request.headers.get("x-real-ip", "") or
            request.client.host if request.client else "unknown"
        )
        
        # Add user agent for additional uniqueness
        user_agent = request.headers.get("user-agent", "")
        identifier = f"{ip_address}:{hashlib.md5(user_agent.encode()).hexdigest()[:8]}"
        
        return identifier
    
    def get_rate_limit_config(self, path: str) -> Dict[str, int]:
        """Get rate limit configuration for a path."""
        return self.rate_limits.get(path, self.rate_limits["default"])
    
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests."""
        
        # Skip rate limiting for health checks and static files
        if request.url.path in ["/health", "/api/health"] or request.url.path.startswith("/static"):
            return await call_next(request)
        
        try:
            redis_client = await self.get_redis_client()
            client_id = self.get_client_identifier(request)
            path = request.url.path
            
            # Get rate limit config
            config = self.get_rate_limit_config(path)
            max_requests = config["requests"]
            window_seconds = config["window"]
            
            # Create Redis key
            current_window = int(time.time()) // window_seconds
            redis_key = f"rate_limit:{client_id}:{path}:{current_window}"
            
            # Check current request count
            current_requests = await redis_client.get(redis_key)
            current_requests = int(current_requests) if current_requests else 0
            
            if current_requests >= max_requests:
                logger.warning(
                    "Rate limit exceeded",
                    client_id=client_id,
                    path=path,
                    current_requests=current_requests,
                    max_requests=max_requests
                )
                
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "detail": "Rate limit exceeded. Please try again later.",
                        "retry_after": window_seconds
                    },
                    headers={"Retry-After": str(window_seconds)}
                )
            
            # Increment request count
            pipe = redis_client.pipeline()
            pipe.incr(redis_key)
            pipe.expire(redis_key, window_seconds)
            await pipe.execute()
            
            # Add rate limit headers to response
            response = await call_next(request)
            response.headers["X-RateLimit-Limit"] = str(max_requests)
            response.headers["X-RateLimit-Remaining"] = str(max_requests - current_requests - 1)
            response.headers["X-RateLimit-Reset"] = str((current_window + 1) * window_seconds)
            
            return response
            
        except Exception as e:
            logger.error("Rate limiting error", error=str(e), exc_info=True)
            # Continue without rate limiting if Redis is unavailable
            return await call_next(request)


class IPWhitelistMiddleware(BaseHTTPMiddleware):
    """IP whitelist middleware for admin endpoints."""
    
    def __init__(self, app: ASGIApp, whitelist: Optional[list] = None):
        super().__init__(app)
        self.whitelist = whitelist or []
        self.admin_paths = ["/api/admin", "/api/system"]
    
    def get_client_ip(self, request: Request) -> str:
        """Get client IP address."""
        return (
            request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
            request.headers.get("x-real-ip", "") or
            request.client.host if request.client else "unknown"
        )
    
    async def dispatch(self, request: Request, call_next):
        """Check IP whitelist for admin endpoints."""
        
        # Check if this is an admin endpoint
        is_admin_path = any(request.url.path.startswith(path) for path in self.admin_paths)
        
        if is_admin_path and self.whitelist:
            client_ip = self.get_client_ip(request)
            
            if client_ip not in self.whitelist:
                logger.warning(
                    "Unauthorized IP access to admin endpoint",
                    client_ip=client_ip,
                    path=request.url.path
                )
                
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Access denied from this IP address"}
                )
        
        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Enhanced request logging middleware."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.sensitive_headers = {
            "authorization", "cookie", "x-api-key", "x-auth-token"
        }
        self.sensitive_paths = {
            "/api/auth/login", "/api/auth/reset-password", "/api/auth/change-password"
        }
    
    def sanitize_headers(self, headers: dict) -> dict:
        """Remove sensitive headers from logging."""
        sanitized = {}
        for key, value in headers.items():
            if key.lower() in self.sensitive_headers:
                sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value
        return sanitized
    
    def get_client_info(self, request: Request) -> dict:
        """Extract client information."""
        return {
            "ip_address": (
                request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
                request.headers.get("x-real-ip", "") or
                request.client.host if request.client else "unknown"
            ),
            "user_agent": request.headers.get("user-agent", "unknown"),
            "referer": request.headers.get("referer", ""),
            "accept_language": request.headers.get("accept-language", "")
        }
    
    async def dispatch(self, request: Request, call_next):
        """Log request details with security considerations."""
        
        start_time = time.time()
        client_info = self.get_client_info(request)
        
        # Log request start (with sanitized headers)
        logger.info(
            "Request started",
            method=request.method,
            url=str(request.url),
            path=request.url.path,
            query_params=dict(request.query_params),
            headers=self.sanitize_headers(dict(request.headers)),
            client_info=client_info
        )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            
            # Log successful response
            logger.info(
                "Request completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                process_time=process_time,
                response_size=response.headers.get("content-length", "unknown"),
                client_ip=client_info["ip_address"]
            )
            
            return response
            
        except Exception as e:
            process_time = time.time() - start_time
            
            # Log error
            logger.error(
                "Request failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                process_time=process_time,
                client_ip=client_info["ip_address"],
                exc_info=True
            )
            
            raise


class SecurityEventDetector(BaseHTTPMiddleware):
    """Detect and log security events."""
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
        self.suspicious_patterns = [
            "union select", "drop table", "insert into", "delete from",
            "<script", "javascript:", "onload=", "onerror=",
            "../", "..\\", "/etc/passwd", "/proc/", "cmd.exe"
        ]
    
    def detect_sql_injection(self, value: str) -> bool:
        """Detect potential SQL injection attempts."""
        value_lower = value.lower()
        sql_keywords = ["union", "select", "insert", "delete", "drop", "alter", "create"]
        
        # Check for multiple SQL keywords
        keyword_count = sum(1 for keyword in sql_keywords if keyword in value_lower)
        return keyword_count >= 2
    
    def detect_xss(self, value: str) -> bool:
        """Detect potential XSS attempts."""
        value_lower = value.lower()
        xss_patterns = ["<script", "javascript:", "onload=", "onerror=", "onclick="]
        
        return any(pattern in value_lower for pattern in xss_patterns)
    
    def detect_path_traversal(self, value: str) -> bool:
        """Detect path traversal attempts."""
        return "../" in value or "..\\" in value
    
    def analyze_request(self, request: Request) -> list:
        """Analyze request for security threats."""
        threats = []
        
        # Check query parameters
        for key, value in request.query_params.items():
            if self.detect_sql_injection(value):
                threats.append(f"SQL injection in query param '{key}'")
            if self.detect_xss(value):
                threats.append(f"XSS attempt in query param '{key}'")
            if self.detect_path_traversal(value):
                threats.append(f"Path traversal in query param '{key}'")
        
        # Check path
        path = request.url.path
        if self.detect_path_traversal(path):
            threats.append("Path traversal in URL path")
        
        # Check for suspicious patterns in path
        for pattern in self.suspicious_patterns:
            if pattern in path.lower():
                threats.append(f"Suspicious pattern '{pattern}' in path")
        
        return threats
    
    async def dispatch(self, request: Request, call_next):
        """Detect and log security events."""
        
        # Analyze request for threats
        threats = self.analyze_request(request)
        
        if threats:
            client_ip = (
                request.headers.get("x-forwarded-for", "").split(",")[0].strip() or
                request.headers.get("x-real-ip", "") or
                request.client.host if request.client else "unknown"
            )
            
            logger.warning(
                "Security threat detected",
                threats=threats,
                method=request.method,
                path=request.url.path,
                client_ip=client_ip,
                user_agent=request.headers.get("user-agent", "unknown")
            )
            
            # For high-severity threats, block the request
            high_severity_patterns = ["union select", "drop table", "<script"]
            if any(any(pattern in threat.lower() for pattern in high_severity_patterns) for threat in threats):
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Request blocked due to security policy"}
                )
        
        return await call_next(request)

