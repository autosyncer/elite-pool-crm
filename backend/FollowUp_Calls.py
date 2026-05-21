from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File
from sqlalchemy.orm import Session
from models import (FollowupSchedule, CallLog, ConstructionLeadModel, AMCLeadModel,
                    FollowupLeadType, CallDuration, FollowupOutcome, UserModel, UserRoleEnum)
from database import get_db
from typing import Optional, List
from datetime import date
from sqlalchemy import func
import uuid
import os
from datetime import date, datetime
import cloudinary.uploader
from cloudinary_config import *



router = APIRouter(prefix="/followup-calls", tags=["followup_calls"])


# ── KPI Summary Cards ──
@router.get("/kpi")
async def get_followup_kpi(db: Session = Depends(get_db)):
    """
    Returns summary metrics for the Follow-up KPI cards.
    No new tables needed — just COUNT queries on existing data.
    """
    # 1. Active Follow-ups = total clients in the followup_schedule table
    active_followups = db.query(func.count(FollowupSchedule.id)).scalar()

    # 2. Calls Today = calls logged with today's date
    calls_today = db.query(func.count(CallLog.id)).filter(
        CallLog.call_date == date.today()
    ).scalar()

    return {
        "active_followups": active_followups,
        "calls_today": calls_today,
    }

@router.get("/available-leads")
async def get_available_leads(db: Session = Depends(get_db)):
    """
    Returns a list of leads from Construction and AMC tables
    that are NOT yet in the follow-up schedule.
    """
    # 1. Get IDs already in followup
    existing_followups = db.query(FollowupSchedule).all()
    # Format: {(id, type), ...}
    existing_set = {(f.lead_id, f.lead_type.value) for f in existing_followups}

    # 2. Get Construction Leads
    c_leads = db.query(ConstructionLeadModel).all()
    available_c = [
        {
            "id": l.id,
            "name": l.name,
            "phone": l.phone,
            "type": "construction"
        }
        for l in c_leads if (l.id, "construction") not in existing_set
    ]

    # 3. Get AMC Leads
    a_leads = db.query(AMCLeadModel).all()
    available_a = [
        {
            "id": l.id,
            "name": l.name,
            "phone": l.phone,
            "type": "amc"
        }
        for l in a_leads if (l.id, "amc") not in existing_set
    ]

    return available_c + available_a



# ── Returns only customer_support usernames for the agent dropdown ──
@router.get("/agents", response_model=List[str])
async def get_support_agents(db: Session = Depends(get_db)):
    agents = db.query(UserModel).filter(
        UserModel.role.in_([UserRoleEnum.customer_support, UserRoleEnum.admin, UserRoleEnum.partner, UserRoleEnum.ceo])
    ).all()
    return [a.username for a in agents]


@router.post("/add-followup-client")
async def add_followup(
    client_name: str = Form(...),
    lead_type: FollowupLeadType = Form(...),
    db: Session = Depends(get_db)
):
    # 1. Find the lead by name in the correct table
    if lead_type == FollowupLeadType.construction:
        lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.name == client_name).first()
    elif lead_type == FollowupLeadType.amc:
        lead = db.query(AMCLeadModel).filter(AMCLeadModel.name == client_name).first()
    else:
        raise HTTPException(status_code=400, detail="Invalid lead_type")

    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # 2. Check if already in schedule
    existing = db.query(FollowupSchedule).filter(
        FollowupSchedule.lead_id == lead.id,
        FollowupSchedule.lead_type == lead_type
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This lead is already in the follow-up schedule")

    # 3. Create the follow-up entry
    new_followup = FollowupSchedule(
        lead_id=lead.id,
        client_name=client_name,
        phone=lead.phone,
        lead_type=lead_type
    )
    db.add(new_followup)
    db.commit()
    db.refresh(new_followup)

    return {
        "message": "Follow-up added successfully",
        "followup": {
            "id": new_followup.id,
            "lead_id": new_followup.lead_id,
            "client_name": new_followup.client_name,
            "phone": new_followup.phone,
            "lead_type": new_followup.lead_type,
            "rating": new_followup.rating,
            "created_at": str(new_followup.created_at)
        }
    }


@router.get("/all-followups")
async def get_all_followups(db: Session = Depends(get_db)):
    schedules = db.query(FollowupSchedule).order_by(FollowupSchedule.created_at.desc()).all()
    
    result = []
    for s in schedules:
        calls = db.query(CallLog).filter(CallLog.schedule_id == s.id).order_by(CallLog.call_number).all()
        result.append({
            "id": s.id,
            "lead_id": s.lead_id,
            "client_name": s.client_name,
            "phone": s.phone,
            "lead_type": s.lead_type,
            "rating": s.rating,
            "created_at": s.created_at,
            "calls": calls
        })
    return result



@router.post("/update-rating")
async def update_rating(
    client_name: str = Form(...),
    rating: int = Form(...),
    db: Session = Depends(get_db)
):
    schedule = db.query(FollowupSchedule).filter(FollowupSchedule.client_name == client_name).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    schedule.rating = rating
    db.commit()
    return {"message": "Rating updated successfully"}


@router.post("/log-call")
async def log_call(
    client_name: str = Form(...),
    call_number: int = Form(...),
    outcome: FollowupOutcome = Form(...),
    duration: CallDuration = Form(...),
    agent_name: str = Form(...),  
    recording: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    # Find the schedule by client name
    schedule = db.query(FollowupSchedule).filter(FollowupSchedule.client_name == client_name).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Follow-up schedule not found")

    # Check if this call number is already logged
    existing_call = db.query(CallLog).filter(
        CallLog.schedule_id == schedule.id,
        CallLog.call_number == call_number
    ).first()

    recording_url = None
    if recording:
        try:
            # Upload to Cloudinary under folder "elite-pool/Call_logs recordings/{schedule.id}"
            upload_result = cloudinary.uploader.upload(
                recording.file,
                folder=f"elite-pool/Call_logs recordings/{schedule.id}",
                public_id=f"touchpoint_{call_number}",
                resource_type="auto"
            )
            recording_url = upload_result.get("secure_url")
        except Exception as e:
            print(f"Error uploading to Cloudinary: {e}")
            raise HTTPException(status_code=502, detail=f"Failed to upload audio to Cloudinary: {str(e)}")

    if (existing_call):
        # Update existing log instead of failing
        existing_call.outcome = outcome
        existing_call.duration = duration
        existing_call.agent_name = agent_name
        existing_call.call_date = date.today()
        
        if recording_url:
            existing_call.recording_url = recording_url
        
        db.commit()
        
        # Trigger Call Log Updated Notification
        try:
            from notifications import trigger_notification
            trigger_notification(
                db=db,
                module="Customer Support",
                action="Call Updated",
                message=f"Touchpoint #{call_number} updated for '{client_name}' by '{agent_name}'.",
                type="update",
                entity_id=str(schedule.id),
                actor_name=agent_name
            )
        except Exception as e:
            print("Error triggering call update notification:", e)

        return {"message": f"Call {call_number} updated successfully"}

    new_call = CallLog(
        schedule_id=schedule.id,
        call_number=call_number,
        outcome=outcome,
        duration=duration,
        agent_name=agent_name,
        recording_url=recording_url
    )
    db.add(new_call)
    db.commit()
    
    # Trigger Call Log Created Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Customer Support",
            action="Call Logged",
            message=f"Touchpoint #{call_number} logged for '{client_name}' by '{agent_name}'.",
            type="create",
            entity_id=str(schedule.id),
            actor_name=agent_name
        )
    except Exception as e:
        print("Error triggering call logged notification:", e)

    return {"message": f"Call {call_number} logged successfully"}


@router.delete("/remove-followup/{client_name}")
async def remove_followup(client_name: str, db: Session = Depends(get_db)):
    schedule = db.query(FollowupSchedule).filter(FollowupSchedule.client_name == client_name).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    db.delete(schedule)
    db.commit()
    
    # Trigger Followup Removed Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Customer Support",
            action="Follow-up Removed",
            message=f"Client '{client_name}' removed from the follow-up active ledger.",
            type="delete",
            entity_id=client_name,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering followup removed notification:", e)

    return {"message": "Follow-up removed successfully"}

@router.delete("/delete-call/{client_name}/{call_number}")
async def delete_call(client_name: str, call_number: int, db: Session = Depends(get_db)):
    schedule = db.query(FollowupSchedule).filter(FollowupSchedule.client_name == client_name).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Follow-up schedule not found")
    
    call = db.query(CallLog).filter(
        CallLog.schedule_id == schedule.id,
        CallLog.call_number == call_number
    ).first()
    
    if not call:
        raise HTTPException(status_code=404, detail=f"Call {call_number} not found for this client")
    
    db.delete(call)
    db.commit()
    return {"message": f"Call {call_number} for {client_name} deleted successfully"}