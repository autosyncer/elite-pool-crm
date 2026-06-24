from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import AttendenceModel, AttendenceType, UserModel

from datetime import date, time, datetime
from sqlalchemy.sql import func

router = APIRouter(prefix="/attendence", tags=["attendence"])


@router.get("/kpi")
async def kpi(db: Session = Depends(get_db)):
    today = date.today()
    
    def count_by_status(status_val):
        return db.query(func.count(AttendenceModel.id)).filter(
            AttendenceModel.status == status_val,
            AttendenceModel.date == today
        ).scalar() or 0

    total_present_today = count_by_status(AttendenceType.present)
    total_absent_today  = count_by_status(AttendenceType.absent)
    total_late_today    = count_by_status(AttendenceType.late)

    
    # Count total employees (users who aren't CEOs/Partners)
    total_employees = db.query(func.count(UserModel.id)).scalar() or 0

    return {
        "total_present_today": total_present_today,
        "total_absent_today": total_absent_today,
        "total_late_today": total_late_today,
        "total_employees": total_employees,
    }


def parse_time_string(time_str: str) -> time:
    """Helper to parse various time formats from frontend/Swagger."""
    if not time_str:
        return None
    
    # Remove 'Z' (UTC indicator) and take only the time part if it's a full ISO string
    if 'T' in time_str:
        time_str = time_str.split('T')[1]
    
    clean_str = time_str.replace('Z', '').strip()
    
    # Handle single digit hour (e.g., '6:30' -> '06:30')
    if ":" in clean_str:
        parts = clean_str.split(":")
        if len(parts[0]) == 1:
            clean_str = "0" + clean_str

    # Try common formats
    formats = [
        "%H:%M:%S.%f", # 10:00:57.820
        "%H:%M:%S",    # 10:00:57
        "%H:%M",       # 10:00
        "%I:%M %p",    # 10:00 AM
        "%I:%M%p"      # 10:00AM
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(clean_str, fmt).time()
        except ValueError:
            continue
            
    # Try ISO format as fallback
    try:
        return time.fromisoformat(clean_str)
    except ValueError:
        pass
        
    raise HTTPException(status_code=400, detail=f"Invalid time format: {time_str}. Use HH:MM or HH:MM:SS")

@router.post("/add_attendence")
async def add_attendence(
        employee_id: int = Form(...),
        date: date = Form(...),
        check_in: str = Form(...),
        check_out: Optional[str] = Form(None),
        status: AttendenceType = Form(...),
        notes: Optional[str] = Form(None),
        db: Session = Depends(get_db)):
    
    existing = db.query(AttendenceModel).filter(
        AttendenceModel.employee_id == employee_id,
        AttendenceModel.date == date
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Attendance already marked for this employee on the selected date")

    parsed_check_in = parse_time_string(check_in)
    parsed_check_out = parse_time_string(check_out)

    new_attendence = AttendenceModel(
        employee_id=employee_id,
        date=date,
        check_in=parsed_check_in,
        check_out=parsed_check_out,
        status=status,
        notes=notes,
    )
    db.add(new_attendence)
    db.commit()
    db.refresh(new_attendence)
    return {
        "message": "Attendence added successfully",
        "attendence": {
            "id": new_attendence.id,
            "employee_id": new_attendence.employee_id,
            "date": str(new_attendence.date),
            "check_in": str(new_attendence.check_in),
            "check_out": str(new_attendence.check_out) if new_attendence.check_out else None,
            "status": new_attendence.status.value,
            "notes": new_attendence.notes,
        }
    }

@router.get("/all_attendence")
async def all_attendence(db: Session = Depends(get_db)):
    attendences = db.query(AttendenceModel).all()
    return [{
        "id": a.id,
        "employee_id": a.employee_id,
        "date": str(a.date),
        "check_in": str(a.check_in) if a.check_in else None,
        "check_out": str(a.check_out) if a.check_out else None,
        "status": a.status.value,
        "notes": a.notes,
    } for a in attendences]

@router.get("/attendence/{employee_id}")
async def get_attendence(employee_id: int, db: Session = Depends(get_db)):
    attendence = db.query(AttendenceModel).filter(AttendenceModel.employee_id == employee_id).all()
    return [{
        "id": a.id,
        "employee_id": a.employee_id,
        "date": str(a.date),
        "check_in": str(a.check_in) if a.check_in else None,
        "check_out": str(a.check_out) if a.check_out else None,
        "status": a.status.value,
        "notes": a.notes,
    } for a in attendence]

@router.put("/edit_attendence/{attendance_id}")
async def edit_attendence(
        attendance_id: int,
        date: date = Form(...),
        check_in: str = Form(...),
        check_out: str = Form(None),
        status: AttendenceType = Form(...),
        notes: Optional[str] = Form(None),
        db: Session = Depends(get_db)):

    attendence = db.query(AttendenceModel).filter(AttendenceModel.id == attendance_id).first()
    if not attendence:
        raise HTTPException(status_code=404, detail="Attendence not found")
    
    attendence.date = date
    attendence.check_in = parse_time_string(check_in)
    attendence.check_out = parse_time_string(check_out)
    attendence.status = status
    attendence.notes = notes
    
    db.commit()
    db.refresh(attendence)
    return {
        "message": "Attendence updated successfully",
        "attendence": {
            "id": attendence.id,
            "employee_id": attendence.employee_id,
            "date": str(attendence.date),
            "check_in": str(attendence.check_in),
            "check_out": str(attendence.check_out) if attendence.check_out else None,
            "status": attendence.status.value,
            "notes": attendence.notes,
        }
    }

@router.delete("/delete_attendence/{attendance_id}")
async def delete_attendence(attendance_id: int, db: Session = Depends(get_db)):
    attendence = db.query(AttendenceModel).filter(AttendenceModel.id == attendance_id).first()
    if not attendence:
        raise HTTPException(status_code=404, detail="Attendence not found")
    db.delete(attendence)
    db.commit()
    return {"message": "Attendence deleted successfully"}