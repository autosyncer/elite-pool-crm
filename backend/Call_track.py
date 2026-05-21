from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import AgentDailyStats
from FollowUp_Calls import FollowupSchedule, CallLog
from datetime import date
from sqlalchemy import func

router = APIRouter(prefix="/call-track", tags=["Call_track"])


@router.get("/kpi")
async def kpi(db: Session = Depends(get_db)):
    # Get Total Team Calls directly from CallLog
    total_calls = db.query(func.count(CallLog.id)).filter(CallLog.call_date == date.today()).scalar() or 0
    return {"total_calls": total_calls}

@router.get("/team-stats")
async def team_stats(db: Session = Depends(get_db)):
    # Group by agent_name and count today's calls in CallLog
    results = db.query(
        CallLog.agent_name,
        func.count(CallLog.id).label("calls_today")
    ).filter(CallLog.call_date == date.today()).group_by(CallLog.agent_name).all()
    
    return [{"agent_name": r.agent_name, "calls_today": r.calls_today} for r in results]

@router.get("/live-logs")
async def live_logs(db: Session = Depends(get_db)):
    # Join CallLog with FollowupSchedule to get client_name
    logs = db.query(CallLog, FollowupSchedule.client_name).join(
        FollowupSchedule, CallLog.schedule_id == FollowupSchedule.id
    ).order_by(CallLog.id.desc()).limit(20).all()
    
    result = []
    for log, client_name in logs:
        # Convert SQLAlchemy model to dict and add client_name
        log_dict = {c.name: getattr(log, c.name) for c in log.__table__.columns}
        log_dict["client_name"] = client_name
        result.append(log_dict)
        
    return result

@router.post("/increment-call/{agent_name}")
async def increment_call(agent_name: str, db: Session = Depends(get_db)):
    stats = db.query(AgentDailyStats).filter(AgentDailyStats.agent_name == agent_name, AgentDailyStats.call_date == date.today()).first()
    if not stats:
        stats = AgentDailyStats(agent_name=agent_name, call_date=date.today(), calls_today=1)
        db.add(stats)
    else:
        stats.calls_today += 1
    db.commit()
    return {"message": "Call incremented", "calls": stats.calls_today}

@router.post("/decrement-call/{agent_name}")
async def decrement_call(agent_name: str, db: Session = Depends(get_db)):
    stats = db.query(AgentDailyStats).filter(AgentDailyStats.agent_name == agent_name, AgentDailyStats.call_date == date.today()).first()
    if stats and stats.calls_today > 0:
        stats.calls_today -= 1
        db.commit()
        return {"message": "Call decremented", "calls": stats.calls_today}
    return {"message": "No calls to decrement"}

@router.get("/agent_tracking/{agent_name}")
async def agent_tracking(
    agent_name: str,
    db: Session = Depends(get_db)
):
    results = db.query(
        CallLog.agent_name,
        func.count(CallLog.id).label("calls_today")
    ).filter(CallLog.call_date == date.today()).group_by(CallLog.agent_name).all()
    
    return [{"agent_name": r.agent_name, "calls_today": r.calls_today} for r in results]


@router.get("/all_schedule")
async def all_schedule(db: Session = Depends(get_db)):
    schedules = db.query(FollowupSchedule).all()
    return schedules