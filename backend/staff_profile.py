from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import StaffProfileModel
from typing import Optional

router = APIRouter(prefix="/staff-profiles", tags=["staff_profiles"])


@router.get("/all")
async def get_all(db: Session = Depends(get_db)):
    profiles = db.query(StaffProfileModel).order_by(StaffProfileModel.name).all()
    return [
        {
            "id":          p.id,
            "name":        p.name,
            "employee_id": p.employee_id,
            "designation": p.designation,
            "account_no":  p.account_no,
            "bank_name":   p.bank_name,
            "doj":         p.doj,
            "phone":       p.phone,
        }
        for p in profiles
    ]


@router.post("/create")
async def create(
    name:        str           = Form(...),
    employee_id: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    account_no:  Optional[str] = Form(None),
    bank_name:   Optional[str] = Form(None),
    doj:         Optional[str] = Form(None),
    phone:       Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    profile = StaffProfileModel(
        name=name, employee_id=employee_id, designation=designation,
        account_no=account_no, bank_name=bank_name, doj=doj, phone=phone,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {"id": profile.id, "message": "Staff profile created"}


@router.put("/update/{profile_id}")
async def update(
    profile_id:  int,
    name:        Optional[str] = Form(None),
    employee_id: Optional[str] = Form(None),
    designation: Optional[str] = Form(None),
    account_no:  Optional[str] = Form(None),
    bank_name:   Optional[str] = Form(None),
    doj:         Optional[str] = Form(None),
    phone:       Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    p = db.query(StaffProfileModel).filter(StaffProfileModel.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    if name        is not None: p.name        = name
    if employee_id is not None: p.employee_id = employee_id
    if designation is not None: p.designation = designation
    if account_no  is not None: p.account_no  = account_no
    if bank_name   is not None: p.bank_name   = bank_name
    if doj         is not None: p.doj         = doj
    if phone       is not None: p.phone       = phone
    db.commit()
    return {"message": "Profile updated"}


@router.delete("/delete/{profile_id}")
async def delete(profile_id: int, db: Session = Depends(get_db)):
    p = db.query(StaffProfileModel).filter(StaffProfileModel.id == profile_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Profile not found")
    db.delete(p)
    db.commit()
    return {"message": "Profile deleted"}
