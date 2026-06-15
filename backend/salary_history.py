from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import SalaryHistoryModel
from typing import Optional
from decimal import Decimal

router = APIRouter(prefix="/salary-history", tags=["salary_history"])


@router.get("/all")
async def get_all(db: Session = Depends(get_db)):
    records = db.query(SalaryHistoryModel).order_by(SalaryHistoryModel.created_at.desc()).all()
    return [
        {
            "id":                r.id,
            "employee_name":     r.employee_name,
            "employee_id":       r.employee_id,
            "designation":       r.designation,
            "month":             r.month,
            "year":              r.year,
            "gross_wages":       float(r.gross_wages or 0),
            "paid_days":         r.paid_days,
            "total_days":        r.total_days,
            "lop_days":          r.lop_days,
            "basic":             float(r.basic or 0),
            "hra":               float(r.hra or 0),
            "conveyance":        float(r.conveyance or 0),
            "medical":           float(r.medical or 0),
            "other":             float(r.other or 0),
            "total_earnings":    float(r.total_earnings or 0),
            "salary_advance":    float(r.salary_advance or 0),
            "balance_deduction": float(r.balance_deduction or 0),
            "professional_tax":  float(r.professional_tax or 0),
            "total_deductions":  float(r.total_deductions or 0),
            "net_salary":        float(r.net_salary or 0),
            "note":              r.note,
            "created_at":        str(r.created_at)[:10] if r.created_at else None,
        }
        for r in records
    ]


@router.post("/create")
async def create(
    employee_name:     str            = Form(...),
    employee_id:       Optional[str]  = Form(None),
    designation:       Optional[str]  = Form(None),
    month:             str            = Form(...),
    year:              str            = Form(...),
    gross_wages:       float          = Form(0),
    paid_days:         int            = Form(0),
    total_days:        int            = Form(31),
    lop_days:          int            = Form(0),
    basic:             float          = Form(0),
    hra:               float          = Form(0),
    conveyance:        float          = Form(0),
    medical:           float          = Form(0),
    other:             float          = Form(0),
    total_earnings:    float          = Form(0),
    salary_advance:    float          = Form(0),
    balance_deduction: float          = Form(0),
    professional_tax:  float          = Form(0),
    total_deductions:  float          = Form(0),
    net_salary:        float          = Form(0),
    note:              Optional[str]  = Form(None),
    db: Session = Depends(get_db),
):
    record = SalaryHistoryModel(
        employee_name=employee_name,
        employee_id=employee_id,
        designation=designation,
        month=month,
        year=year,
        gross_wages=Decimal(str(gross_wages)),
        paid_days=paid_days,
        total_days=total_days,
        lop_days=lop_days,
        basic=Decimal(str(basic)),
        hra=Decimal(str(hra)),
        conveyance=Decimal(str(conveyance)),
        medical=Decimal(str(medical)),
        other=Decimal(str(other)),
        total_earnings=Decimal(str(total_earnings)),
        salary_advance=Decimal(str(salary_advance)),
        balance_deduction=Decimal(str(balance_deduction)),
        professional_tax=Decimal(str(professional_tax)),
        total_deductions=Decimal(str(total_deductions)),
        net_salary=Decimal(str(net_salary)),
        note=note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "message": "Salary record saved"}


@router.delete("/delete/{record_id}")
async def delete(record_id: int, db: Session = Depends(get_db)):
    r = db.query(SalaryHistoryModel).filter(SalaryHistoryModel.id == record_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Record not found")
    db.delete(r)
    db.commit()
    return {"message": "Deleted"}
