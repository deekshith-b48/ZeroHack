"""
Notifications API
Handles notification management and delivery.
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime

from backend.services.notification_service import NotificationService
from backend.utils.security import get_current_user
from backend.utils.logger import get_logger

logger = get_logger(__name__)
router = APIRouter()

class NotificationResponse(BaseModel):
    """Notification response model."""
    id: str
    type: str
    title: str
    message: str
    severity: str
    created_at: datetime
    read: bool

class NotificationPreferences(BaseModel):
    """Notification preferences model."""
    email_enabled: bool
    sms_enabled: bool
    push_enabled: bool
    webhook_url: Optional[str] = None

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    limit: int = 50,
    unread_only: bool = False,
    notification_service: NotificationService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get user notifications."""
    try:
        notifications = await notification_service.get_user_notifications(
            user_id=current_user["id"],
            limit=limit,
            unread_only=unread_only
        )
        
        return [
            NotificationResponse(
                id=notif["id"],
                type=notif["type"],
                title=notif["title"],
                message=notif["message"],
                severity=notif["severity"],
                created_at=notif["created_at"],
                read=notif["read"]
            )
            for notif in notifications
        ]
        
    except Exception as e:
        logger.error(f"Failed to get notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notifications")

@router.put("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    notification_service: NotificationService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read."""
    try:
        await notification_service.mark_as_read(notification_id, current_user["id"])
        return {"message": "Notification marked as read"}
        
    except Exception as e:
        logger.error(f"Failed to mark notification as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark notification as read")

@router.get("/preferences", response_model=NotificationPreferences)
async def get_notification_preferences(
    notification_service: NotificationService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Get user notification preferences."""
    try:
        preferences = await notification_service.get_user_preferences(current_user["id"])
        return NotificationPreferences(**preferences)
        
    except Exception as e:
        logger.error(f"Failed to get notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to get notification preferences")

@router.put("/preferences", response_model=NotificationPreferences)
async def update_notification_preferences(
    preferences: NotificationPreferences,
    notification_service: NotificationService = Depends(),
    current_user: dict = Depends(get_current_user)
):
    """Update user notification preferences."""
    try:
        updated_preferences = await notification_service.update_user_preferences(
            user_id=current_user["id"],
            preferences=preferences.dict()
        )
        return NotificationPreferences(**updated_preferences)
        
    except Exception as e:
        logger.error(f"Failed to update notification preferences: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification preferences")
