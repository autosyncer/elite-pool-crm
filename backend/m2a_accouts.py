from fastapi import APIRouter, Depends, Form, HTTPException
from database import get_db
from sqlalchemy.orm import Session
from models import m2aAccounts, m2a_payments, m2a_expenses, m2aExpenseType
from typing import Optional
from datetime import date
from sqlalchemy.sql import func

router = APIRouter(prefix="/m2a_accouts", tags=["m2a_accouts"])  


@router.get("/kpi")
async def kpi(db: Session = Depends(get_db)):
    # Total Inflow
    total_inflow = db.query(func.sum(m2a_payments.amount)).scalar()

    # Total Expense
    total_expense = db.query(func.sum(m2a_expenses.amount)).scalar()

    # Net Balance 
    net_balance = total_inflow - total_expense

    return {
        "total_inflow": total_inflow,
        "total_expense": total_expense,
        "net_balance": net_balance,
    }

@router.post("/new_accout_from_admin")
async def new_accout_from_admin(
    site_name: str = Form(...),
    location: str = Form(...),
    initial_advance_payment: float = Form(0),
    payment_date: date = Form(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        new_accout = m2aAccounts(
            site_name=site_name,
            location=location,
            note=note
        )
        db.add(new_accout)
        db.commit()
        db.refresh(new_accout)

        if initial_advance_payment > 0:
            advance_payment = m2a_payments(
                account_id=new_accout.id,
                amount=initial_advance_payment,
                payment_date=payment_date or date.today()
            )
            db.add(advance_payment)
            db.commit()

        return {
            "message": "Account created successfully",
            "account": {
                "id": new_accout.id,
                "site_name": new_accout.site_name,
                "location": new_accout.location,
                "initial_payment": initial_advance_payment,
                "notes": new_accout.note,
                "last_updated": str(new_accout.last_updated),
                "created_at": str(new_accout.created_at),
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all_m2a_accounts")
async def get_all_m2a_accounts(db: Session = Depends(get_db)):
    accounts = db.query(m2aAccounts).all()
    result = []
    for acc in accounts:
        payments = db.query(m2a_payments).filter(m2a_payments.account_id == acc.id).all()
        expenses = db.query(m2a_expenses).filter(m2a_expenses.account_id == acc.id).all()
        
        total_payment = sum(p.amount for p in payments)
        total_expense = sum(e.amount for e in expenses)
        
        result.append({
            "id": acc.id,
            "site_name": acc.site_name,
            "location": acc.location,
            "note": acc.note,
            "last_updated": str(acc.last_updated),
            "created_at": str(acc.created_at),
            "total_recieved": float(total_payment),
            "total_expense": float(total_expense),
            "payments": [{"amount": float(p.amount), "payment_date": str(p.payment_date)} for p in payments],
            "expenses": [{"amount": float(e.amount), "expense_date": str(e.expense_date), "description": e.description, "expense_type": e.expense_type} for e in expenses]
        })
    return result

@router.get("/account_details/{site_name}")
async def get_account_details(site_name: str, db: Session = Depends(get_db)):
    try:
        account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        payments = db.query(m2a_payments).filter(m2a_payments.account_id == account.id).all()
        expenses = db.query(m2a_expenses).filter(m2a_expenses.account_id == account.id).all()
        
        return {
            "account": {
                "id": account.id,
                "site_name": account.site_name,
                "location": account.location,
                "last_updated": str(account.last_updated)
            },
            "payments": [
                {"amount": float(p.amount), "payment_date": str(p.payment_date)}
                for p in payments
            ],
            "expenses": [
                {
                    "amount": float(e.amount),
                    "expense_date": str(e.expense_date),
                    "description": e.description,
                    "expense_type": str(e.expense_type) if e.expense_type else None
                }
                for e in expenses
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/m2a_account/{site_name}")
async def get_m2a_account(site_name: str, db: Session = Depends(get_db)):
    account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account



@router.get("/total_amount_recieved/{site_name}")
async def get_total_recieved(site_name: str, db: Session = Depends(get_db)):
    account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    total_recieved = db.query(func.sum(m2a_payments.amount)).filter(m2a_payments.account_id == account.id).scalar()
    return total_recieved



@router.get("/total_expense/{site_name}")
async def get_total_expense(site_name: str, db: Session = Depends(get_db)):
    account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    total_expense = db.query(func.sum(m2a_expenses.amount)).filter(m2a_expenses.account_id == account.id).scalar()
    return total_expense

@router.put("/update_account/{site_name}")
async def update_account(
    site_name: str, 
    amount: float = Form(...), 
    payment_date: date = Form(...), 
    db: Session = Depends(get_db)
):
    account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    new_payment = m2a_payments(
        account_id=account.id,
        amount=amount,
        payment_date=payment_date
    )
    db.add(new_payment)
    account.last_updated = func.now() 
    db.commit()
    
    return {
        "message": f"New payment of ₹{amount} recorded successfully for {site_name}",
        "account": {
            "id": account.id,
            "site_name": account.site_name,
            "location": account.location,
            "note": account.note,
            "last_updated": str(account.last_updated)
        }
    }

@router.put("/add_expenses/{site_name}")
async def add_expenses(
    site_name: str, 
    amount: float = Form(...), 
    expense_type: m2aExpenseType = Form(...),
    expense_date: date = Form(...),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    new_expense = m2a_expenses(
        account_id=account.id,
        amount=amount,
        expense_type=expense_type,
        expense_date=expense_date,
        description=description
    )
    db.add(new_expense)
    account.last_updated = func.now() 
    db.commit()
    
    return {
        "message": f"New expense of ₹{amount} ({expense_type}) recorded for {site_name}",
        "account": {
            "id": account.id,
            "site_name": account.site_name,
            "last_updated": str(account.last_updated)
        }
    }

@router.delete("/delete_account/{site_name}")
async def delete_account(site_name: str, db: Session = Depends(get_db)):
    try:
        account = db.query(m2aAccounts).filter(m2aAccounts.site_name == site_name).first()
        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        db.delete(account)
        db.commit()
        return {"message": "Account deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/deleting_payment_recieved/{payment_id}")
async def deleting_payment_recieved(payment_id: int, db: Session = Depends(get_db)):
    try:
        payment = db.query(m2a_payments).filter(m2a_payments.id == payment_id).first()
        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")
        db.delete(payment)
        db.commit()
        return {"message": "Payment deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/deleting_expense/{expense_id}")
async def deleting_expense(expense_id: int, db: Session = Depends(get_db)):
    try:
        expense = db.query(m2a_expenses).filter(m2a_expenses.id == expense_id).first()
        if not expense:
            raise HTTPException(status_code=404, detail="Expense not found")
        db.delete(expense)
        db.commit()
        return {"message": "Expense deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
