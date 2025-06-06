"""
Email service for sending authentication-related emails.
"""

from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from typing import List, Optional
import structlog
from jinja2 import Template

from config.settings import get_settings

logger = structlog.get_logger()
settings = get_settings()

class EmailService:
    """Email service for authentication and notifications."""
    
    def __init__(self):
        if settings.SMTP_HOST:
            self.conf = ConnectionConfig(
                MAIL_USERNAME=settings.SMTP_USERNAME,
                MAIL_PASSWORD=settings.SMTP_PASSWORD,
                MAIL_FROM=settings.FROM_EMAIL,
                MAIL_PORT=settings.SMTP_PORT,
                MAIL_SERVER=settings.SMTP_HOST,
                MAIL_STARTTLS=settings.SMTP_USE_TLS,
                MAIL_SSL_TLS=False,
                USE_CREDENTIALS=True,
                VALIDATE_CERTS=True
            )
            self.fastmail = FastMail(self.conf)
        else:
            self.fastmail = None
            logger.warning("Email service not configured - SMTP settings missing")
    
    async def send_email(
        self,
        recipients: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None
    ) -> bool:
        """Send email to recipients."""
        
        if not self.fastmail:
            logger.error("Cannot send email - email service not configured")
            return False
        
        try:
            message = MessageSchema(
                subject=subject,
                recipients=recipients,
                body=html_content,
                subtype="html"
            )
            
            await self.fastmail.send_message(message)
            
            logger.info(
                "Email sent successfully",
                recipients=recipients,
                subject=subject
            )
            
            return True
            
        except Exception as e:
            logger.error(
                "Failed to send email",
                error=str(e),
                recipients=recipients,
                subject=subject,
                exc_info=True
            )
            return False
    
    async def send_password_reset_email(
        self,
        email: str,
        name: str,
        reset_token: str
    ) -> bool:
        """Send password reset email."""
        
        # In production, this would be a proper frontend URL
        reset_url = f"http://localhost:3000/reset-password?token={reset_token}"
        
        html_template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Password Reset - Learning Management System</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f8f9fa; }
                .button { 
                    display: inline-block; 
                    padding: 12px 24px; 
                    background-color: #007bff; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 4px; 
                    margin: 20px 0;
                }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Learning Management System</h1>
                    <h2>Password Reset Request</h2>
                </div>
                
                <div class="content">
                    <p>Hello {{ name }},</p>
                    
                    <p>We received a request to reset your password for your LMS account. If you made this request, please click the button below to reset your password:</p>
                    
                    <div style="text-align: center;">
                        <a href="{{ reset_url }}" class="button">Reset Password</a>
                    </div>
                    
                    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
                    <p style="word-break: break-all; background-color: #e9ecef; padding: 10px; border-radius: 4px;">{{ reset_url }}</p>
                    
                    <div class="warning">
                        <strong>Security Notice:</strong>
                        <ul>
                            <li>This link will expire in 1 hour for security reasons</li>
                            <li>If you didn't request this password reset, please ignore this email</li>
                            <li>Never share this link with anyone</li>
                        </ul>
                    </div>
                    
                    <p>If you continue to have problems, please contact our support team.</p>
                    
                    <p>Best regards,<br>The LMS Team</p>
                </div>
                
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p>© 2024 Learning Management System. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """)
        
        html_content = html_template.render(
            name=name,
            reset_url=reset_url
        )
        
        return await self.send_email(
            recipients=[email],
            subject="Password Reset - Learning Management System",
            html_content=html_content
        )
    
    async def send_welcome_email(
        self,
        email: str,
        name: str,
        temporary_password: Optional[str] = None
    ) -> bool:
        """Send welcome email to new user."""
        
        html_template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Welcome - Learning Management System</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f8f9fa; }
                .button { 
                    display: inline-block; 
                    padding: 12px 24px; 
                    background-color: #28a745; 
                    color: white; 
                    text-decoration: none; 
                    border-radius: 4px; 
                    margin: 20px 0;
                }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .credentials { background-color: #e9ecef; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Welcome to LMS!</h1>
                </div>
                
                <div class="content">
                    <p>Hello {{ name }},</p>
                    
                    <p>Welcome to the Learning Management System! Your account has been successfully created.</p>
                    
                    {% if temporary_password %}
                    <div class="credentials">
                        <h3>Your Login Credentials:</h3>
                        <p><strong>Email:</strong> {{ email }}</p>
                        <p><strong>Temporary Password:</strong> {{ temporary_password }}</p>
                        <p><em>Please change your password after your first login for security.</em></p>
                    </div>
                    {% endif %}
                    
                    <div style="text-align: center;">
                        <a href="http://localhost:3000/login" class="button">Login to LMS</a>
                    </div>
                    
                    <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
                    
                    <p>Best regards,<br>The LMS Team</p>
                </div>
                
                <div class="footer">
                    <p>© 2024 Learning Management System. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """)
        
        html_content = html_template.render(
            name=name,
            email=email,
            temporary_password=temporary_password
        )
        
        return await self.send_email(
            recipients=[email],
            subject="Welcome to Learning Management System",
            html_content=html_content
        )
    
    async def send_2fa_code_email(
        self,
        email: str,
        name: str,
        otp_code: str
    ) -> bool:
        """Send 2FA verification code via email."""
        
        html_template = Template("""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Two-Factor Authentication Code</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #ffc107; color: #212529; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f8f9fa; }
                .code { 
                    font-size: 32px; 
                    font-weight: bold; 
                    text-align: center; 
                    background-color: #e9ecef; 
                    padding: 20px; 
                    margin: 20px 0; 
                    border-radius: 4px;
                    letter-spacing: 4px;
                }
                .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
                .warning { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; margin: 20px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Two-Factor Authentication</h1>
                </div>
                
                <div class="content">
                    <p>Hello {{ name }},</p>
                    
                    <p>Your two-factor authentication code is:</p>
                    
                    <div class="code">{{ otp_code }}</div>
                    
                    <div class="warning">
                        <strong>Security Notice:</strong>
                        <ul>
                            <li>This code will expire in 5 minutes</li>
                            <li>Never share this code with anyone</li>
                            <li>If you didn't request this code, please contact support immediately</li>
                        </ul>
                    </div>
                    
                    <p>Enter this code in the LMS application to complete your login.</p>
                    
                    <p>Best regards,<br>The LMS Team</p>
                </div>
                
                <div class="footer">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        """)
        
        html_content = html_template.render(
            name=name,
            otp_code=otp_code
        )
        
        return await self.send_email(
            recipients=[email],
            subject="Your Two-Factor Authentication Code",
            html_content=html_content
        )

