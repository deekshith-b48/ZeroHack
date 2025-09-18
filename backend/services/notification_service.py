"""
Notification Service
Handles email, SMS, and webhook notifications.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import smtplib
import json
import aiohttp
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from backend.utils.logger import get_logger

logger = get_logger(__name__)

class NotificationService:
    """Centralized notification service for alerts and communications."""
    
    def __init__(self):
        self.smtp_server = None
        self.smtp_port = None
        self.smtp_username = None
        self.smtp_password = None
        self.sms_api_key = None
        self.webhook_urls = []
        self.is_initialized = False
        
    async def initialize(self):
        """Initialize notification service."""
        try:
            logger.info("📧 Initializing Notification Service...")
            
            # Load configuration
            self.smtp_server = os.getenv("ZEROHACK_SMTP_SERVER", "smtp.gmail.com")
            self.smtp_port = int(os.getenv("ZEROHACK_SMTP_PORT", "587"))
            self.smtp_username = os.getenv("ZEROHACK_SMTP_USERNAME")
            self.smtp_password = os.getenv("ZEROHACK_SMTP_PASSWORD")
            self.sms_api_key = os.getenv("ZEROHACK_SMS_API_KEY")
            
            # Load webhook URLs
            webhook_urls_str = os.getenv("ZEROHACK_WEBHOOK_URLS", "")
            if webhook_urls_str:
                self.webhook_urls = [url.strip() for url in webhook_urls_str.split(",")]
            
            self.is_initialized = True
            logger.info("✅ Notification Service initialized successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Notification Service: {e}")
            raise
    
    async def send_incident_alert(self, incident, blockchain_tx: Optional[Dict] = None):
        """Send incident alert notifications."""
        try:
            if not self.is_initialized:
                logger.warning("Notification service not initialized")
                return
            
            # Prepare notification data
            alert_data = {
                "incident_id": incident.id,
                "attack_type": incident.attack_type,
                "severity": incident.severity.value,
                "source_ip": incident.source_ip,
                "description": incident.description,
                "confidence_score": incident.confidence_score,
                "timestamp": incident.created_at.isoformat(),
                "blockchain_tx_hash": blockchain_tx.get("tx_hash") if blockchain_tx else None
            }
            
            # Send email notification
            await self._send_email_alert(alert_data)
            
            # Send webhook notifications
            await self._send_webhook_alert(alert_data)
            
            # Send SMS for critical incidents
            if incident.severity.value in ["CRITICAL", "HIGH"]:
                await self._send_sms_alert(alert_data)
            
            logger.info(f"✅ Incident alert sent for {incident.id}")
            
        except Exception as e:
            logger.error(f"Failed to send incident alert: {e}")
    
    async def send_verification_email(self, user):
        """Send email verification to user."""
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.warning("SMTP credentials not configured")
                return
            
            # Generate verification token
            verification_token = self._generate_verification_token(user.id)
            
            # Create email content
            subject = "Verify your ZeroHack account"
            body = f"""
            Hello {user.full_name},
            
            Please verify your ZeroHack account by clicking the link below:
            
            {os.getenv("ZEROHACK_BASE_URL", "http://localhost:3000")}/verify-email?token={verification_token}
            
            This link will expire in 24 hours.
            
            Best regards,
            ZeroHack Team
            """
            
            await self._send_email(
                to_email=user.email,
                subject=subject,
                body=body
            )
            
            logger.info(f"✅ Verification email sent to {user.email}")
            
        except Exception as e:
            logger.error(f"Failed to send verification email: {e}")
    
    async def send_password_reset_email(self, user, reset_token: str):
        """Send password reset email."""
        try:
            if not self.smtp_username or not self.smtp_password:
                logger.warning("SMTP credentials not configured")
                return
            
            subject = "Reset your ZeroHack password"
            body = f"""
            Hello {user.full_name},
            
            You requested a password reset for your ZeroHack account.
            
            Click the link below to reset your password:
            
            {os.getenv("ZEROHACK_BASE_URL", "http://localhost:3000")}/reset-password?token={reset_token}
            
            This link will expire in 1 hour.
            
            If you didn't request this reset, please ignore this email.
            
            Best regards,
            ZeroHack Team
            """
            
            await self._send_email(
                to_email=user.email,
                subject=subject,
                body=body
            )
            
            logger.info(f"✅ Password reset email sent to {user.email}")
            
        except Exception as e:
            logger.error(f"Failed to send password reset email: {e}")
    
    async def get_user_notifications(self, user_id: str, limit: int = 50, unread_only: bool = False) -> List[Dict[str, Any]]:
        """Get user notifications."""
        try:
            # This would integrate with your database
            # For now, return mock data
            notifications = [
                {
                    "id": f"notif_{i}",
                    "type": "incident_alert",
                    "title": f"Security Alert {i}",
                    "message": f"New threat detected: {['Malware', 'Phishing', 'DDoS'][i % 3]}",
                    "severity": ["LOW", "MEDIUM", "HIGH"][i % 3],
                    "created_at": datetime.utcnow(),
                    "read": i % 3 == 0
                }
                for i in range(min(limit, 10))
            ]
            
            if unread_only:
                notifications = [n for n in notifications if not n["read"]]
            
            return notifications
            
        except Exception as e:
            logger.error(f"Failed to get user notifications: {e}")
            return []
    
    async def mark_as_read(self, notification_id: str, user_id: str):
        """Mark notification as read."""
        try:
            # This would update the database
            logger.info(f"Marked notification {notification_id} as read for user {user_id}")
            
        except Exception as e:
            logger.error(f"Failed to mark notification as read: {e}")
    
    async def get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user notification preferences."""
        try:
            # This would get from database
            return {
                "email_enabled": True,
                "sms_enabled": False,
                "push_enabled": True,
                "webhook_url": None
            }
            
        except Exception as e:
            logger.error(f"Failed to get user preferences: {e}")
            return {}
    
    async def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        """Update user notification preferences."""
        try:
            # This would update the database
            logger.info(f"Updated notification preferences for user {user_id}")
            return preferences
            
        except Exception as e:
            logger.error(f"Failed to update user preferences: {e}")
            return {}
    
    async def _send_email_alert(self, alert_data: Dict[str, Any]):
        """Send email alert."""
        try:
            if not self.smtp_username or not self.smtp_password:
                return
            
            subject = f"🚨 Security Alert: {alert_data['attack_type']} - {alert_data['severity']}"
            body = f"""
            Security Incident Alert
            
            Incident ID: {alert_data['incident_id']}
            Attack Type: {alert_data['attack_type']}
            Severity: {alert_data['severity']}
            Source IP: {alert_data['source_ip']}
            Confidence Score: {alert_data['confidence_score']:.2f}
            Timestamp: {alert_data['timestamp']}
            
            Description:
            {alert_data['description']}
            
            Blockchain Transaction: {alert_data['blockchain_tx_hash'] or 'N/A'}
            
            Please review this incident in the ZeroHack dashboard.
            """
            
            await self._send_email(
                to_email=os.getenv("ZEROHACK_ALERT_EMAIL", "admin@zerohack.local"),
                subject=subject,
                body=body
            )
            
        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
    
    async def _send_sms_alert(self, alert_data: Dict[str, Any]):
        """Send SMS alert."""
        try:
            if not self.sms_api_key:
                return
            
            message = f"🚨 ZEROHACK ALERT: {alert_data['attack_type']} detected from {alert_data['source_ip']} - Severity: {alert_data['severity']}"
            
            # This would integrate with SMS service (Twilio, etc.)
            logger.info(f"SMS Alert: {message}")
            
        except Exception as e:
            logger.error(f"Failed to send SMS alert: {e}")
    
    async def _send_webhook_alert(self, alert_data: Dict[str, Any]):
        """Send webhook alert."""
        try:
            if not self.webhook_urls:
                return
            
            payload = {
                "event_type": "security_alert",
                "timestamp": datetime.utcnow().isoformat(),
                "data": alert_data
            }
            
            async with aiohttp.ClientSession() as session:
                for webhook_url in self.webhook_urls:
                    try:
                        async with session.post(
                            webhook_url,
                            json=payload,
                            timeout=aiohttp.ClientTimeout(total=10)
                        ) as response:
                            if response.status == 200:
                                logger.info(f"✅ Webhook alert sent to {webhook_url}")
                            else:
                                logger.warning(f"⚠️ Webhook failed: {response.status}")
                    except Exception as e:
                        logger.error(f"Failed to send webhook to {webhook_url}: {e}")
            
        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
    
    async def _send_email(self, to_email: str, subject: str, body: str):
        """Send email using SMTP."""
        try:
            # Create message
            msg = MIMEMultipart()
            msg['From'] = self.smtp_username
            msg['To'] = to_email
            msg['Subject'] = subject
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            server.starttls()
            server.login(self.smtp_username, self.smtp_password)
            server.send_message(msg)
            server.quit()
            
            logger.info(f"✅ Email sent to {to_email}")
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
    
    def _generate_verification_token(self, user_id: str) -> str:
        """Generate verification token."""
        import secrets
        return secrets.token_urlsafe(32)
    
    def is_ready(self) -> bool:
        """Check if notification service is ready."""
        return self.is_initialized
    
    async def cleanup(self):
        """Cleanup notification service."""
        logger.info("🧹 Cleaning up Notification Service...")
        # Cleanup any resources if needed
        pass
