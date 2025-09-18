"""
Incident Management API
Handles incident reporting, retrieval, and management.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

from backend.services.ai_service import AIService
from backend.services.blockchain_service import BlockchainService
from backend.services.notification_service import NotificationService
from backend.db.models import Incident, IncidentStatus, ThreatSeverity
from backend.db.schemas import IncidentResponse, IncidentCreate, IncidentUpdate
from backend.utils.security import get_current_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class IncidentSubmission(BaseModel):
    """Model for incident submission with file upload."""
    description: str = Field(..., description="Description of the incident")
    source_ip: Optional[str] = Field(None, description="Source IP address")
    attack_type: Optional[str] = Field(None, description="Type of attack detected")
    evidence_files: Optional[List[str]] = Field(None, description="List of uploaded file IDs")

@router.post("/", response_model=IncidentResponse, status_code=201)
async def create_incident(
    incident_data: IncidentCreate,
    ai_service: AIService = Depends(),
    blockchain_service: BlockchainService = Depends(),
    notification_service: NotificationService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Create a new incident report."""
    try:
        # Generate unique incident ID
        incident_id = str(uuid.uuid4())
        
        # Run AI analysis on the incident data
        ai_analysis = await ai_service.analyze_incident(
            description=incident_data.description,
            source_ip=incident_data.source_ip,
            evidence_files=incident_data.evidence_files or []
        )
        
        # Create incident record
        incident = Incident(
            id=incident_id,
            reporter_id=current_user["id"],
            description=incident_data.description,
            source_ip=incident_data.source_ip,
            attack_type=ai_analysis.get("threat_type", "Unknown"),
            severity=ThreatSeverity(ai_analysis.get("severity", "LOW")),
            status=IncidentStatus.ACTIVE,
            confidence_score=ai_analysis.get("confidence", 0.0),
            ai_analysis=ai_analysis,
            created_at=datetime.utcnow()
        )
        
        # Save to database
        await incident.save()
        
        # Log to blockchain for chain of custody
        blockchain_tx = await blockchain_service.log_incident(
            incident_id=incident_id,
            source_ip=incident_data.source_ip,
            attack_type=incident.attack_type,
            explanation=incident_data.description,
            evidence_hash=ai_analysis.get("evidence_hash", "")
        )
        
        # Send notifications if high severity
        if incident.severity in [ThreatSeverity.HIGH, ThreatSeverity.CRITICAL]:
            await notification_service.send_incident_alert(incident, blockchain_tx)
        
        # Return response
        return IncidentResponse(
            id=incident.id,
            description=incident.description,
            source_ip=incident.source_ip,
            attack_type=incident.attack_type,
            severity=incident.severity.value,
            status=incident.status.value,
            confidence_score=incident.confidence_score,
            blockchain_tx_hash=blockchain_tx.get("tx_hash") if blockchain_tx else None,
            created_at=incident.created_at,
            updated_at=incident.updated_at
        )
        
    except Exception as e:
        logger.error(f"Failed to create incident: {e}")
        raise HTTPException(status_code=500, detail="Failed to create incident")

@router.get("/", response_model=List[IncidentResponse])
async def get_incidents(
    status: Optional[IncidentStatus] = None,
    severity: Optional[ThreatSeverity] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get incidents with optional filtering."""
    try:
        incidents = await Incident.get_filtered(
            status=status,
            severity=severity,
            limit=limit,
            offset=offset
        )
        
        return [
            IncidentResponse(
                id=incident.id,
                description=incident.description,
                source_ip=incident.source_ip,
                attack_type=incident.attack_type,
                severity=incident.severity.value,
                status=incident.status.value,
                confidence_score=incident.confidence_score,
                blockchain_tx_hash=incident.blockchain_tx_hash,
                created_at=incident.created_at,
                updated_at=incident.updated_at
            )
            for incident in incidents
        ]
        
    except Exception as e:
        logger.error(f"Failed to get incidents: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve incidents")

@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific incident by ID."""
    try:
        incident = await Incident.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        return IncidentResponse(
            id=incident.id,
            description=incident.description,
            source_ip=incident.source_ip,
            attack_type=incident.attack_type,
            severity=incident.severity.value,
            status=incident.status.value,
            confidence_score=incident.confidence_score,
            blockchain_tx_hash=incident.blockchain_tx_hash,
            created_at=incident.created_at,
            updated_at=incident.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve incident")

@router.put("/{incident_id}", response_model=IncidentResponse)
async def update_incident(
    incident_id: str,
    incident_update: IncidentUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update an incident."""
    try:
        incident = await Incident.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        # Update fields
        for field, value in incident_update.dict(exclude_unset=True).items():
            setattr(incident, field, value)
        
        incident.updated_at = datetime.utcnow()
        await incident.save()
        
        return IncidentResponse(
            id=incident.id,
            description=incident.description,
            source_ip=incident.source_ip,
            attack_type=incident.attack_type,
            severity=incident.severity.value,
            status=incident.status.value,
            confidence_score=incident.confidence_score,
            blockchain_tx_hash=incident.blockchain_tx_hash,
            created_at=incident.created_at,
            updated_at=incident.updated_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update incident")

@router.post("/{incident_id}/evidence")
async def upload_evidence(
    incident_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload evidence file for an incident."""
    try:
        incident = await Incident.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        
        # Validate file type and size
        if file.size > 10 * 1024 * 1024:  # 10MB limit
            raise HTTPException(status_code=413, detail="File too large")
        
        # Generate file hash for integrity verification
        file_content = await file.read()
        file_hash = await generate_file_hash(file_content)
        
        # Store file (implement your file storage logic)
        file_id = await store_evidence_file(file, file_hash)
        
        # Update incident with new evidence
        if not incident.evidence_files:
            incident.evidence_files = []
        incident.evidence_files.append({
            "file_id": file_id,
            "filename": file.filename,
            "hash": file_hash,
            "uploaded_at": datetime.utcnow().isoformat()
        })
        await incident.save()
        
        return {"file_id": file_id, "hash": file_hash}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to upload evidence for incident {incident_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload evidence")

async def generate_file_hash(content: bytes) -> str:
    """Generate SHA-256 hash of file content."""
    import hashlib
    return hashlib.sha256(content).hexdigest()

async def store_evidence_file(file: UploadFile, file_hash: str) -> str:
    """Store evidence file and return file ID."""
    # Implement your file storage logic here
    # This could be local storage, S3, IPFS, etc.
    file_id = str(uuid.uuid4())
    # Store file logic here
    return file_id
