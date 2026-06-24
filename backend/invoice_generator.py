from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import InvoiceModel, ElitePoolAccounts, ElitePoolExpenses, ElitePoolExpenseType
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from decimal import Decimal
from datetime import date as date_type
import json

router = APIRouter(prefix="/invoices", tags=["invoices"])


class LineItem(BaseModel):
    description: str
    hsn: Optional[str] = ""
    qty: float = 1
    unit: Optional[str] = ""
    rate: float = 0
    amount: float = 0


class InvoiceCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    invoice_no: str
    invoice_date: str
    due_date: Optional[str] = None
    gr_no: Optional[str] = None
    order_no: Optional[str] = None
    project: Optional[str] = None
    state: Optional[str] = "Telangana"
    state_code: Optional[str] = "36"
    bill_to_name: str
    bill_to_address: Optional[str] = None
    bill_to_gstin: Optional[str] = None
    ship_to_name: Optional[str] = None
    ship_to_address: Optional[str] = None
    ship_to_gstin: Optional[str] = None
    items: List[LineItem]
    gst_rate: float = 9
    sub_total: float = 0
    cgst: float = 0
    sgst: float = 0
    igst: float = 0
    round_off: float = 0
    total: float = 0
    notes: Optional[str] = None
    created_by: Optional[str] = None
    billed_by: Optional[str] = None   # 'CEO' or 'Admin'


def _fmt(inv: InvoiceModel) -> dict:
    return {
        "id": inv.id,
        "invoice_no": inv.invoice_no,
        "invoice_date": str(inv.invoice_date) if inv.invoice_date else None,
        "due_date": inv.due_date,
        "gr_no": inv.gr_no,
        "order_no": inv.order_no,
        "project": inv.project,
        "state": inv.state,
        "state_code": inv.state_code,
        "bill_to_name": inv.bill_to_name,
        "bill_to_address": inv.bill_to_address,
        "bill_to_gstin": inv.bill_to_gstin,
        "ship_to_name": inv.ship_to_name,
        "ship_to_address": inv.ship_to_address,
        "ship_to_gstin": inv.ship_to_gstin,
        "items": json.loads(inv.items_json or "[]"),
        "gst_rate": float(inv.gst_rate or 9),
        "sub_total": float(inv.sub_total or 0),
        "cgst": float(inv.cgst or 0),
        "sgst": float(inv.sgst or 0),
        "igst": float(inv.igst or 0),
        "round_off": float(inv.round_off or 0),
        "total": float(inv.total or 0),
        "notes": inv.notes,
        "created_by": inv.created_by,
        "billed_by": inv.billed_by,
        "created_at": str(inv.created_at)[:10] if inv.created_at else None,
    }


@router.get("/next-number")
async def next_invoice_number(db: Session = Depends(get_db)):
    """Return next sequential invoice number like EPB-001."""
    last = db.query(InvoiceModel).order_by(InvoiceModel.id.desc()).first()
    if not last:
        return {"invoice_no": "EPB-001"}
    # Try to extract numeric suffix from existing invoice numbers
    import re
    all_nos = [r.invoice_no for r in db.query(InvoiceModel.invoice_no).all()]
    max_num = 0
    for no in all_nos:
        m = re.search(r'(\d+)$', str(no or ''))
        if m:
            max_num = max(max_num, int(m.group(1)))
    next_num = max_num + 1
    return {"invoice_no": f"EPB-{next_num:03d}"}


@router.get("/by-project/{project_name}")
async def get_by_project(project_name: str, db: Session = Depends(get_db)):
    records = db.query(InvoiceModel).filter(
        InvoiceModel.project == project_name
    ).order_by(InvoiceModel.created_at.desc()).all()
    return [_fmt(r) for r in records]


@router.get("/by-role/{role}")
async def get_by_role(role: str, db: Session = Depends(get_db)):
    records = db.query(InvoiceModel).filter(
        InvoiceModel.billed_by == role
    ).order_by(InvoiceModel.created_at.desc()).all()
    return [_fmt(r) for r in records]


@router.get("/all")
async def get_all(db: Session = Depends(get_db)):
    records = db.query(InvoiceModel).order_by(InvoiceModel.created_at.desc()).all()
    return [_fmt(r) for r in records]


def _deduct_from_ep_site(db: Session, data):
    """Record invoice total as an expense on the linked EP site account."""
    if not data.project or not data.total or float(data.total) <= 0:
        print(f"[invoice-deduct] skipped — project='{data.project}' total={data.total}")
        return
    try:
        # Case-insensitive site name match
        from sqlalchemy import func as sqlfunc
        account = db.query(ElitePoolAccounts).filter(
            sqlfunc.lower(ElitePoolAccounts.site_name) == str(data.project).strip().lower()
        ).first()
        if not account:
            print(f"[invoice-deduct] no EP account found for project='{data.project}'")
            return
        try:
            raw = str(data.invoice_date)[:10]
            if len(raw) >= 10 and raw[4] == '-':
                pay_date = date_type.fromisoformat(raw)
            else:
                parts = raw.split('-')
                pay_date = date_type(int(parts[2]), int(parts[1]), int(parts[0]))
        except Exception:
            pay_date = date_type.today()

        desc = f"Inv#{data.invoice_no} | {data.billed_by or data.created_by or 'Unknown'}"[:255]
        expense = ElitePoolExpenses(
            account_id=account.id,
            amount=Decimal(str(data.total)),
            expenses_type=ElitePoolExpenseType.miscellaneous,
            payment_date=pay_date,
            description=desc,
            note=None,
        )
        db.add(expense)
        db.commit()
        print(f"[invoice-deduct] ✓ deducted ₹{data.total} from '{account.site_name}' (id={account.id})")
    except Exception as e:
        db.rollback()
        print(f"[invoice-deduct] ✗ FAILED for project='{data.project}': {e}")


@router.post("/create")
async def create(data: InvoiceCreate, db: Session = Depends(get_db)):
    existing = db.query(InvoiceModel).filter(InvoiceModel.invoice_no == data.invoice_no).first()
    if existing:
        # Already saved — check if deduction was missed and apply it now
        already_deducted = db.query(ElitePoolExpenses).filter(
            ElitePoolExpenses.description.like(f"Inv#{data.invoice_no}%")
        ).first()
        if not already_deducted:
            _deduct_from_ep_site(db, data)
        raise HTTPException(status_code=400, detail=f"Invoice {data.invoice_no} already exists")

    inv = InvoiceModel(
        invoice_no=data.invoice_no,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        gr_no=data.gr_no,
        order_no=data.order_no,
        project=data.project,
        state=data.state,
        state_code=data.state_code,
        bill_to_name=data.bill_to_name,
        bill_to_address=data.bill_to_address,
        bill_to_gstin=data.bill_to_gstin,
        ship_to_name=data.ship_to_name,
        ship_to_address=data.ship_to_address,
        ship_to_gstin=data.ship_to_gstin,
        items_json=json.dumps([i.dict() for i in data.items]),
        gst_rate=Decimal(str(data.gst_rate)),
        sub_total=Decimal(str(data.sub_total)),
        cgst=Decimal(str(data.cgst)),
        sgst=Decimal(str(data.sgst)),
        igst=Decimal(str(data.igst)),
        round_off=Decimal(str(data.round_off)),
        total=Decimal(str(data.total)),
        notes=data.notes,
        created_by=data.created_by,
        billed_by=data.billed_by,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)

    # Auto-deduct invoice total from the EP site account as an expense
    _deduct_from_ep_site(db, data)

    return {"id": inv.id, "invoice_no": inv.invoice_no, "message": "Invoice saved"}


@router.get("/{invoice_id}")
async def get_one(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return _fmt(inv)


@router.put("/update/{invoice_id}")
async def update(invoice_id: int, data: InvoiceCreate, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for field, val in data.dict(exclude={"items"}).items():
        if hasattr(inv, field):
            setattr(inv, field, val)
    inv.items_json = json.dumps([i.dict() for i in data.items])
    db.commit()
    return {"message": "Updated"}


@router.delete("/delete/{invoice_id}")
async def delete(invoice_id: int, db: Session = Depends(get_db)):
    inv = db.query(InvoiceModel).filter(InvoiceModel.id == invoice_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(inv)
    db.commit()
    return {"message": "Deleted"}
