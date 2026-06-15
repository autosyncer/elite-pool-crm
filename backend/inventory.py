from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import InventoryModel, VendorModel
from typing import Optional
from decimal import Decimal

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("/all")
async def get_all_inventory(db: Session = Depends(get_db)):
    items = db.query(InventoryModel).order_by(InventoryModel.item_name).all()
    return [
        {
            "id": item.id,
            "item_name": item.item_name,
            "category": item.category,
            "quantity": float(item.quantity or 0),
            "unit": item.unit,
            "min_quantity": float(item.min_quantity or 0),
            "vendor_id": item.vendor_id,
            "vendor_name": item.vendor.name if item.vendor else None,
            "notes": item.notes,
            "low_stock": float(item.quantity or 0) <= float(item.min_quantity or 0),
            "created_at": str(item.created_at)[:10] if item.created_at else None,
            "updated_at": str(item.updated_at)[:10] if item.updated_at else None,
        }
        for item in items
    ]


@router.post("/create")
async def create_inventory_item(
    item_name: str = Form(...),
    category: Optional[str] = Form(None),
    quantity: float = Form(0),
    unit: Optional[str] = Form(None),
    min_quantity: float = Form(0),
    vendor_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    item = InventoryModel(
        item_name=item_name,
        category=category,
        quantity=Decimal(str(quantity)),
        unit=unit,
        min_quantity=Decimal(str(min_quantity)),
        vendor_id=vendor_id,
        notes=notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "item_name": item.item_name, "message": "Item created"}


@router.put("/update/{item_id}")
async def update_inventory_item(
    item_id: int,
    item_name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
    quantity: Optional[float] = Form(None),
    unit: Optional[str] = Form(None),
    min_quantity: Optional[float] = Form(None),
    vendor_id: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    item = db.query(InventoryModel).filter(InventoryModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    if item_name is not None:
        item.item_name = item_name
    if category is not None:
        item.category = category
    if quantity is not None:
        item.quantity = Decimal(str(quantity))
    if unit is not None:
        item.unit = unit
    if min_quantity is not None:
        item.min_quantity = Decimal(str(min_quantity))
    if vendor_id is not None:
        item.vendor_id = vendor_id
    if notes is not None:
        item.notes = notes

    db.commit()
    return {"message": "Item updated"}


@router.put("/adjust/{item_id}")
async def adjust_quantity(
    item_id: int,
    adjustment: float = Form(...),
    db: Session = Depends(get_db),
):
    """Adjust stock quantity (positive = add, negative = deduct)"""
    item = db.query(InventoryModel).filter(InventoryModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    new_qty = float(item.quantity or 0) + adjustment
    if new_qty < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    item.quantity = Decimal(str(new_qty))
    db.commit()
    return {"message": "Quantity adjusted", "new_quantity": new_qty}


@router.delete("/delete/{item_id}")
async def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(InventoryModel).filter(InventoryModel.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"message": "Item deleted"}
