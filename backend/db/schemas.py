"""
Pydantic schemas for API requests and responses.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    """User role enumeration."""
    ADMIN = "admin"
    ANALYST = "analyst"
    COMMANDER = "commander"
    VIEWER = "viewer"

class ThreatSeverity(str, Enum):
    """Threat severity enumeration."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"

class IncidentStatus(str, Enum):
    """Incident status enumeration."""
    ACTIVE = "ACTIVE"
    INVESTIGATING = "INVESTIGATING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

# User schemas
class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr
    full_name: str
    organization: Optional[str] = None
    role: UserRole = UserRole.ANALYST

class UserCreate(UserBase):
    """User creation schema."""
    password: str = Field(..., min_length=8)

class UserUpdate(BaseModel):
    """User update schema."""
    full_name: Optional[str] = None
    organization: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase):
    """User response schema."""
    id: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

# Incident schemas
class IncidentBase(BaseModel):
    """Base incident schema."""
    description: str = Field(..., min_length=10)
    source_ip: Optional[str] = None
    attack_type: Optional[str] = None

class IncidentCreate(IncidentBase):
    """Incident creation schema."""
    evidence_files: Optional[List[str]] = None

class IncidentUpdate(BaseModel):
    """Incident update schema."""
    description: Optional[str] = None
    status: Optional[IncidentStatus] = None
    severity: Optional[ThreatSeverity] = None

class IncidentResponse(IncidentBase):
    """Incident response schema."""
    id: str
    severity: str
    status: str
    confidence_score: float
    blockchain_tx_hash: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Authentication schemas
class LoginRequest(BaseModel):
    """Login request schema."""
    email: EmailStr
    password: str
    totp_code: Optional[str] = None

class TokenResponse(BaseModel):
    """Token response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class PasswordResetRequest(BaseModel):
    """Password reset request schema."""
    email: EmailStr

class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""
    token: str
    new_password: str = Field(..., min_length=8)

# AI Analysis schemas
class TextAnalysisRequest(BaseModel):
    """Text analysis request schema."""
    text: str = Field(..., min_length=1)
    analysis_type: str = "comprehensive"

class ImageAnalysisRequest(BaseModel):
    """Image analysis request schema."""
    image_data: str = Field(..., description="Base64 encoded image data")
    analysis_type: str = "steganography"

class NetworkTrafficRequest(BaseModel):
    """Network traffic analysis request schema."""
    traffic_data: List[Dict[str, Any]] = Field(..., min_items=1)
    session_id: Optional[str] = None

class AnalysisResponse(BaseModel):
    """Analysis response schema."""
    threat_detected: bool
    threat_type: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: str
    explanation: str
    model_details: Dict[str, Any]
    processing_time: float

# Blockchain schemas
class EvidenceRecord(BaseModel):
    """Evidence record schema."""
    incident_id: str
    file_hash: str
    transaction_hash: str
    block_number: int
    timestamp: datetime
    verified: bool

class BlockchainStatus(BaseModel):
    """Blockchain status schema."""
    connected: bool
    network: str
    latest_block: int
    contract_addresses: Dict[str, str]

# Notification schemas
class NotificationResponse(BaseModel):
    """Notification response schema."""
    id: str
    type: str
    title: str
    message: str
    severity: str
    created_at: datetime
    read: bool

class NotificationPreferences(BaseModel):
    """Notification preferences schema."""
    email_enabled: bool = True
    sms_enabled: bool = False
    push_enabled: bool = True
    webhook_url: Optional[str] = None

# Dashboard schemas
class DashboardStats(BaseModel):
    """Dashboard statistics schema."""
    total_incidents: int
    active_incidents: int
    high_severity_incidents: int
    threats_detected_today: int
    ai_models_active: int
    blockchain_transactions: int
    system_health: str

class ThreatHeatmapData(BaseModel):
    """Threat heatmap data schema."""
    latitude: float
    longitude: float
    threat_count: int
    severity: str
    timestamp: datetime

class RecentActivity(BaseModel):
    """Recent activity schema."""
    id: str
    type: str
    description: str
    timestamp: datetime
    severity: Optional[str] = None
