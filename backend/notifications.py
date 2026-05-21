from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import get_db
from models import NotificationModel, NotificationType, NotificationStatus, UserModel
from auth import get_current_active_user, UserInDB

router = APIRouter(prefix="/notifications", tags=["notifications"])

# --- Pydantic Schemas ---

class NotificationBase(BaseModel):
    type: NotificationType
    module: str
    action: str
    message: str
    entity_id: Optional[str] = None
    actor_name: Optional[str] = None

class NotificationCreate(NotificationBase):
    user_id: Optional[int] = None # Optional: if null, might be for all admins or system-wide

class NotificationUpdate(BaseModel):
    status: NotificationStatus

class NotificationResponse(NotificationBase):
    id: int
    user_id: Optional[int]
    status: NotificationStatus
    created_at: datetime

    class Config:
        from_attributes = True

# --- API Endpoints ---

@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    db: Session = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Fetch notifications for the currently logged-in user."""
    # Get user object from DB to get the ID
    db_user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Fetch notifications specifically for this user OR system-wide ones (user_id is null)
    notifications = db.query(NotificationModel).filter(
        (NotificationModel.user_id == db_user.id) | (NotificationModel.user_id == None)
    ).order_by(NotificationModel.created_at.desc()).limit(50).all()
    
    return notifications

@router.post("/", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    notification: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """
    Internal endpoint to trigger a notification.
    In a real app, this might be called by other service functions.
    """
    new_notif = NotificationModel(
        user_id=notification.user_id,
        type=notification.type,
        module=notification.module,
        action=notification.action,
        message=notification.message,
        entity_id=notification.entity_id,
        actor_name=notification.actor_name or current_user.full_name,
        status=NotificationStatus.unread
    )
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    return new_notif

@router.patch("/{notification_id}", response_model=NotificationResponse)
async def update_notification_status(
    notification_id: int,
    update_data: NotificationUpdate,
    db: Session = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Update notification status (mark as viewed or done)."""
    db_notif = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()
    if not db_notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    # Security check: Ensure user owns this notification (unless it's system-wide)
    db_user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
    if db_notif.user_id and db_notif.user_id != db_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to update this notification")

    db_notif.status = update_data.status
    db.commit()
    db.refresh(db_notif)
    return db_notif

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: UserInDB = Depends(get_current_active_user)
):
    """Delete a specific notification."""
    db_notif = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()
    if not db_notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    db_user = db.query(UserModel).filter(UserModel.username == current_user.username).first()
    if db_notif.user_id and db_notif.user_id != db_user.id:
         raise HTTPException(status_code=403, detail="Not authorized to delete this notification")

    db.delete(db_notif)
    db.commit()
    return None


def trigger_notification(
    db: Session,
    module: str,
    action: str,
    message: str,
    type: str = "create",  # "create", "update", "delete", "system"
    entity_id: str = None,
    actor_name: str = "System",
    user_id: int = None
):
    """Creates and persists a new CRUD notification in the database."""
    if isinstance(type, str):
        try:
            type_enum = NotificationType(type)
        except ValueError:
            type_enum = NotificationType.system
    else:
        type_enum = type

    new_notif = NotificationModel(
        user_id=user_id,
        type=type_enum,
        module=module,
        action=action,
        message=message,
        entity_id=entity_id,
        actor_name=actor_name,
        status=NotificationStatus.unread
    )
    db.add(new_notif)
    db.commit()
    return new_notif

