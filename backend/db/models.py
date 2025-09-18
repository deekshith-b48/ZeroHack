"""
Database models for ZeroHack application.
"""

from sqlalchemy import Column, String, Integer, Float, DateTime, Boolean, Text, JSON, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from datetime import datetime
import uuid
import enum

from backend.db.database import Base

class UserRole(enum.Enum):
    """User role enumeration."""
    ADMIN = "admin"
    ANALYST = "analyst"
    COMMANDER = "commander"
    VIEWER = "viewer"

class ThreatSeverity(enum.Enum):
    """Threat severity enumeration."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class IncidentStatus(enum.Enum):
    """Incident status enumeration."""
    ACTIVE = "ACTIVE"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

class User(Base):
    """User model."""
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    organization = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.ANALYST, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String, nullable=True)
    backup_codes = Column(JSON, nullable=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    @classmethod
    async def get_by_email(cls, email: str):
        """Get user by email."""
        # This would use async database session
        # For now, return None as placeholder
        return None
    
    @classmethod
    async def get_by_id(cls, user_id: str):
        """Get user by ID."""
        # This would use async database session
        # For now, return None as placeholder
        return None
    
    async def save(self):
        """Save user to database."""
        # This would use async database session
        pass

class Incident(Base):
    """Incident model."""
    __tablename__ = "incidents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    reporter_id = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)
    source_ip = Column(String, nullable=True)
    attack_type = Column(String, nullable=False)
    severity = Column(Enum(ThreatSeverity), default=ThreatSeverity.LOW, nullable=False)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.ACTIVE, nullable=False)
    confidence_score = Column(Float, default=0.0, nullable=False)
    ai_analysis = Column(JSON, nullable=True)
    evidence_files = Column(JSON, nullable=True)
    geo_location = Column(JSON, nullable=True)
    blockchain_tx_hash = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now(), nullable=False)
    
    @classmethod
    async def get_by_id(cls, incident_id: str):
        """Get incident by ID."""
        # This would use async database session
        # For now, return None as placeholder
        return None
    
    @classmethod
    async def get_filtered(cls, status=None, severity=None, limit=100, offset=0):
        """Get filtered incidents."""
        # This would use async database session with filters
        # For now, return empty list as placeholder
        return []
    
    @classmethod
    async def count(cls):
        """Get total incident count."""
        # This would use async database session
        return 0
    
    @classmethod
    async def count_by_status(cls, status: str):
        """Get incident count by status."""
        # This would use async database session
        return 0
    
    @classmethod
    async def count_by_severity(cls, *severities):
        """Get incident count by severity."""
        # This would use async database session
        return 0
    
    @classmethod
    async def count_by_date(cls, date):
        """Get incident count by date."""
        # This would use async database session
        return 0
    
    @classmethod
    async def get_by_date_range(cls, start_date, end_date):
        """Get incidents by date range."""
        # This would use async database session
        return []
    
    @classmethod
    async def get_recent(cls, limit=20):
        """Get recent incidents."""
        # This would use async database session
        return []
    
    async def save(self):
        """Save incident to database."""
        # This would use async database session
        pass

class Notification(Base):
    """Notification model."""
    __tablename__ = "notifications"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, nullable=False, index=True)
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    severity = Column(String, nullable=False)
    read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now(), nullable=False)
    
    @classmethod
    async def get_user_notifications(cls, user_id: str, limit=50, unread_only=False):
        """Get user notifications."""
        # This would use async database session
        return []
    
    @classmethod
    async def mark_as_read(cls, notification_id: str, user_id: str):
        """Mark notification as read."""
        # This would use async database session
        pass
