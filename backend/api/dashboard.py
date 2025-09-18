"""
Dashboard API
Provides data for dashboard components and analytics.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, timedelta

from backend.db.models import Incident, User
from backend.services.ai_service import AIService
from backend.services.blockchain_service import BlockchainService
from backend.utils.security import get_current_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class DashboardStats(BaseModel):
    """Dashboard statistics model."""
    total_incidents: int
    active_incidents: int
    high_severity_incidents: int
    threats_detected_today: int
    ai_models_active: int
    blockchain_transactions: int
    system_health: str

class ThreatHeatmapData(BaseModel):
    """Threat heatmap data model."""
    latitude: float
    longitude: float
    threat_count: int
    severity: str
    timestamp: datetime

class RecentActivity(BaseModel):
    """Recent activity model."""
    id: str
    type: str
    description: str
    timestamp: datetime
    severity: Optional[str] = None

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_user: dict = Depends(get_current_user),
    ai_service: AIService = Depends(),
    blockchain_service: BlockchainService = Depends()
):
    """Get dashboard statistics."""
    try:
        # Get incident statistics
        total_incidents = await Incident.count()
        active_incidents = await Incident.count_by_status("ACTIVE")
        high_severity_incidents = await Incident.count_by_severity("HIGH", "CRITICAL")
        
        # Get today's threats
        today = datetime.utcnow().date()
        threats_today = await Incident.count_by_date(today)
        
        # Get AI model status
        ai_status = await ai_service.get_model_status()
        active_models = sum(1 for model in ai_status.get("models", {}).values() if model.get("status") == "ready")
        
        # Get blockchain stats
        blockchain_status = await blockchain_service.get_status()
        blockchain_tx_count = blockchain_status.get("transaction_count", 0)
        
        # Determine system health
        system_health = "healthy"
        if active_incidents > 10:
            system_health = "warning"
        if high_severity_incidents > 5:
            system_health = "critical"
        
        return DashboardStats(
            total_incidents=total_incidents,
            active_incidents=active_incidents,
            high_severity_incidents=high_severity_incidents,
            threats_detected_today=threats_today,
            ai_models_active=active_models,
            blockchain_transactions=blockchain_tx_count,
            system_health=system_health
        )
        
    except Exception as e:
        logger.error(f"Failed to get dashboard stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get dashboard statistics")

@router.get("/threat-heatmap", response_model=List[ThreatHeatmapData])
async def get_threat_heatmap_data(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get threat heatmap data for the specified period."""
    try:
        # Get incidents with geolocation data
        start_date = datetime.utcnow() - timedelta(days=days)
        incidents = await Incident.get_by_date_range(start_date, datetime.utcnow())
        
        # Group by location and severity
        heatmap_data = []
        location_counts = {}
        
        for incident in incidents:
            if incident.source_ip and incident.geo_location:
                lat, lon = incident.geo_location.get("latitude"), incident.geo_location.get("longitude")
                if lat and lon:
                    key = f"{lat:.2f},{lon:.2f}"
                    if key not in location_counts:
                        location_counts[key] = {
                            "latitude": lat,
                            "longitude": lon,
                            "count": 0,
                            "max_severity": "LOW"
                        }
                    
                    location_counts[key]["count"] += 1
                    if incident.severity in ["HIGH", "CRITICAL"]:
                        location_counts[key]["max_severity"] = incident.severity
        
        # Convert to response format
        for data in location_counts.values():
            heatmap_data.append(ThreatHeatmapData(
                latitude=data["latitude"],
                longitude=data["longitude"],
                threat_count=data["count"],
                severity=data["max_severity"],
                timestamp=datetime.utcnow()
            ))
        
        return heatmap_data
        
    except Exception as e:
        logger.error(f"Failed to get threat heatmap data: {e}")
        raise HTTPException(status_code=500, detail="Failed to get threat heatmap data")

@router.get("/recent-activity", response_model=List[RecentActivity])
async def get_recent_activity(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get recent system activity."""
    try:
        # Get recent incidents
        recent_incidents = await Incident.get_recent(limit)
        
        activities = []
        for incident in recent_incidents:
            activities.append(RecentActivity(
                id=incident.id,
                type="incident",
                description=f"New {incident.attack_type} incident detected",
                timestamp=incident.created_at,
                severity=incident.severity.value
            ))
        
        # Sort by timestamp (most recent first)
        activities.sort(key=lambda x: x.timestamp, reverse=True)
        
        return activities[:limit]
        
    except Exception as e:
        logger.error(f"Failed to get recent activity: {e}")
        raise HTTPException(status_code=500, detail="Failed to get recent activity")

@router.get("/ai-pipeline-status")
async def get_ai_pipeline_status(
    ai_service: AIService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get AI pipeline status and model information."""
    try:
        status = await ai_service.get_model_status()
        return status
        
    except Exception as e:
        logger.error(f"Failed to get AI pipeline status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get AI pipeline status")
