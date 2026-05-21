from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import ElitePoolAccounts, ElitePoolProjectType, ElitePoolPayments, ElitePoolExpenses, ElitePoolExpenseType, ConstructionLeadModel, AMCLeadModel
from typing import Optional
from datetime import date
from sqlalchemy.sql import func, text, or_

router = APIRouter(prefix="/elite-pool-accounts", tags=["elite_pool_accounts"])



@router.get("/kpi")
async def kpi(db: Session = Depends(get_db)):
    # Total Inflow
    total_inflow = db.query(func.sum(ElitePoolPayments.amount)).scalar()

    # Total Expense
    total_expense = db.query(func.sum(ElitePoolExpenses.amount)).scalar()

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
    project_type: ElitePoolProjectType = Form(...),
    initial_advance_payment: float = Form(0),
    payment_date: date = Form(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        new_accout = ElitePoolAccounts(
            site_name=site_name,
            location=location,
            project_type=project_type,
            note=note
        )
        db.add(new_accout)
        db.commit()
        db.refresh(new_accout)

        if initial_advance_payment > 0:
            advance_payment = ElitePoolPayments(
                account_id=new_accout.id,
                amount=initial_advance_payment,
                payment_date=payment_date
            )
            db.add(advance_payment)
            db.commit()

        return {
            "message": "Account created successfully",
            "account": {
                "id": new_accout.id,
                "site_name": new_accout.site_name,
                "location": new_accout.location,
                "project_type": new_accout.project_type,
                "note": new_accout.note,
                "last_updated": str(new_accout.last_update),
                "created_at": str(new_accout.created_at),
            }
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/adding_leads_from_construction/{identifier}")
async def adding_leads_from_construction(
    identifier: str,
    location: str = Form(...),         
    initial_advance_payment: float = Form(...),
    payment_date: date = Form(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(ConstructionLeadModel)
        if identifier.isdigit():
            lead = query.filter(or_(ConstructionLeadModel.id == int(identifier), ConstructionLeadModel.lead_code == identifier, ConstructionLeadModel.name == identifier)).first()
        else:
            lead = query.filter(or_(ConstructionLeadModel.lead_code == identifier, ConstructionLeadModel.name == identifier)).first()

        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Check if already exists
        existing = db.query(ElitePoolAccounts).filter(ElitePoolAccounts.site_name == lead.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Client already in ledger")

        new_accout = ElitePoolAccounts(
            site_name=lead.name,
            location=location,
            project_type=ElitePoolProjectType.pool_construction,
            note=note
        )
        db.add(new_accout)
        db.commit() 
        db.refresh(new_accout)

        if initial_advance_payment > 0:
            db.add(ElitePoolPayments(account_id=new_accout.id, amount=initial_advance_payment, payment_date=payment_date))
            db.commit()

        return {"message": f"Account created for {lead.name}"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/adding_leads_from_amc/{identifier}")
async def adding_leads_from_amc(
    identifier: str,
    location: str = Form(...),         
    initial_advance_payment: float = Form(...),
    payment_date: date = Form(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(AMCLeadModel)
        if identifier.isdigit():
            lead = query.filter(or_(AMCLeadModel.id == int(identifier), AMCLeadModel.lead_code == identifier, AMCLeadModel.name == identifier)).first()
        else:
            lead = query.filter(or_(AMCLeadModel.lead_code == identifier, AMCLeadModel.name == identifier)).first()

        if not lead:
            raise HTTPException(status_code=404, detail="Lead not found")

        # Check if already exists
        existing = db.query(ElitePoolAccounts).filter(ElitePoolAccounts.site_name == lead.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Client already in ledger")

        new_accout = ElitePoolAccounts(
            site_name=lead.name,
            location=location,
            project_type=ElitePoolProjectType.pool_amc,
            note=note
        )
        db.add(new_accout)
        db.commit() 
        db.refresh(new_accout)

        if initial_advance_payment > 0:
            db.add(ElitePoolPayments(account_id=new_accout.id, amount=initial_advance_payment, payment_date=payment_date))
            db.commit()

        return {"message": f"Account created for {lead.name}"}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all_ep_accounts")
async def get_all_ep_accounts(db: Session = Depends(get_db)):
    accounts = db.query(ElitePoolAccounts).all()
    result = []
    for acc in accounts:
        payments = db.query(ElitePoolPayments).filter(ElitePoolPayments.account_id == acc.id).all()
        expenses = db.query(ElitePoolExpenses).filter(ElitePoolExpenses.account_id == acc.id).all()
        
        total_payment = sum(p.amount for p in payments)
        total_expense = sum(e.amount for e in expenses)
        
        result.append({
            "id": acc.id,
            "site_name": acc.site_name,
            "location": acc.location,
            "project_type": acc.project_type,
            "note": acc.note,
            "last_update": str(acc.last_update),
            "created_at": str(acc.created_at),
            "received": float(total_payment),
            "spent": float(total_expense),
            "payments": [{"amount": float(p.amount), "payment_date": str(p.payment_date)} for p in payments],
            "expenses": [{"amount": float(e.amount), "payment_date": str(e.payment_date), "description": e.description, "expenses_type": e.expenses_type} for e in expenses]
        })
    return result

@router.get("/account_details/{identifier}")
async def get_account_details(identifier: str, db: Session = Depends(get_db)):
    try:
        query = db.query(ElitePoolAccounts)
        if identifier.isdigit():
            account = query.filter(or_(ElitePoolAccounts.id == int(identifier), ElitePoolAccounts.site_name == identifier)).first()
        else:
            account = query.filter(ElitePoolAccounts.site_name == identifier).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        payments = db.query(ElitePoolPayments).filter(ElitePoolPayments.account_id == account.id).all()
        expenses = db.query(ElitePoolExpenses).filter(ElitePoolExpenses.account_id == account.id).all()
        
        return {
            "account": {
                "id": account.id,
                "site_name": account.site_name,
                "location": account.location,
                "project_type": account.project_type,
                "last_update": str(account.last_update)
            },
            "payments": [
                {"amount": float(p.amount), "payment_date": str(p.payment_date)}
                for p in payments
            ],
            "expenses": [
                {
                    "amount": float(e.amount),
                    "payment_date": str(e.payment_date),
                    "description": e.description,
                    "expenses_type": str(e.expenses_type) if e.expenses_type else None
                }
                for e in expenses
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.put("/add_payment/{identifier}")
async def add_payment(
    identifier: str, # Can be ID or Site Name
    amount: float = Form(...), 
    payment_date: date = Form(...),
    db: Session = Depends(get_db)
):
    try:
        query = db.query(ElitePoolAccounts)
        if identifier.isdigit():
            account = query.filter(or_(ElitePoolAccounts.id == int(identifier), ElitePoolAccounts.site_name == identifier)).first()
        else:
            account = query.filter(ElitePoolAccounts.site_name == identifier).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        new_payment = ElitePoolPayments(
            account_id=account.id,
            amount=amount,
            payment_date=payment_date
        )
        db.add(new_payment)
        account.last_update = func.now() 
        db.commit()
        
        return {"message": "Payment recorded successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))




@router.put("/add_expenses/{identifier}")
async def add_expenses(
    identifier: str, # Can be ID or Site Name
    amount: float = Form(...), 
    expense_type: ElitePoolExpenseType = Form(...),
    expense_date: date = Form(...),
    description: str = Form(...),
    note: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        
        # Search by ID (if identifier is a number) OR Site Name
        query = db.query(ElitePoolAccounts)
        if identifier.isdigit():
            account = query.filter(or_(ElitePoolAccounts.id == int(identifier), ElitePoolAccounts.site_name == identifier)).first()
        else:
            account = query.filter(ElitePoolAccounts.site_name == identifier).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        
        new_expense = ElitePoolExpenses(
            account_id=account.id,
            amount=amount,
            expenses_type=expense_type, 
            payment_date=expense_date,  
            description=description,
            note=note
        )
        db.add(new_expense)
        account.last_update = func.now() 
        db.commit()
        
        return {"message": "Expense recorded successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete_account/{identifier}")
async def delete_ep_account(identifier: str, db: Session = Depends(get_db)):
    try:
        query = db.query(ElitePoolAccounts)
        if identifier.isdigit():
            account = query.filter(or_(ElitePoolAccounts.id == int(identifier), ElitePoolAccounts.site_name == identifier)).first()
        else:
            account = query.filter(ElitePoolAccounts.site_name == identifier).first()

        if not account:
            raise HTTPException(status_code=404, detail="Account not found")
        db.delete(account)
        db.commit()
        return {"message": "Account deleted successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
