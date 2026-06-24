from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import VendorModel, VendorCategoryEnum
from typing import Optional

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("/all")
async def get_all_vendors(db: Session = Depends(get_db)):
    vendors = db.query(VendorModel).order_by(VendorModel.name).all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "category": v.category,
            "gst_number": v.gst_number,
            "contact_person": v.contact_person,
            "phone": v.phone,
            "email": v.email,
            "address": v.address,
            "rating": v.rating,
            "notes": v.notes,
            "created_at": str(v.created_at)[:10] if v.created_at else None,
        }
        for v in vendors
    ]


@router.post("/create")
async def create_vendor(
    name: str = Form(...),
    category: VendorCategoryEnum = Form(...),
    gst_number: Optional[str] = Form(None),
    contact_person: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    rating: Optional[int] = Form(0),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    vendor = VendorModel(
        name=name,
        category=category,
        gst_number=gst_number,
        contact_person=contact_person,
        phone=phone,
        email=email,
        address=address,
        rating=rating or 0,
        notes=notes,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return {"id": vendor.id, "name": vendor.name, "message": "Vendor created"}


@router.put("/update/{vendor_id}")
async def update_vendor(
    vendor_id: int,
    name: Optional[str] = Form(None),
    category: Optional[VendorCategoryEnum] = Form(None),
    gst_number: Optional[str] = Form(None),
    contact_person: Optional[str] = Form(None),
    phone: Optional[str] = Form(None),
    email: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    rating: Optional[int] = Form(None),
    notes: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    vendor = db.query(VendorModel).filter(VendorModel.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if name is not None:
        vendor.name = name
    if category is not None:
        vendor.category = category
    if gst_number is not None:
        vendor.gst_number = gst_number
    if contact_person is not None:
        vendor.contact_person = contact_person
    if phone is not None:
        vendor.phone = phone
    if email is not None:
        vendor.email = email
    if address is not None:
        vendor.address = address
    if rating is not None:
        vendor.rating = rating
    if notes is not None:
        vendor.notes = notes

    db.commit()
    return {"message": "Vendor updated"}


@router.delete("/delete/{vendor_id}")
async def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    vendor = db.query(VendorModel).filter(VendorModel.id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    db.delete(vendor)
    db.commit()
    return {"message": "Vendor deleted"}
