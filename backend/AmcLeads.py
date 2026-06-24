import csv
import random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import AMCLeadModel, LeadStatus, LeadSource

from pydantic import BaseModel
from typing import Optional

class AMCLeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    requirements: Optional[str] = None
    priority: Optional[str] = None
    location: Optional[str] = None
    inquiry_source: Optional[str] = None
    notes: Optional[str] = None

router = APIRouter(prefix="/amc-leads", tags=["amc_leads"])

def map_source(src_str: str) -> LeadSource:
    src_lower = src_str.lower()
    if "meta" in src_lower: return LeadSource.meta_ad
    if "google" in src_lower: return LeadSource.google_ad
    if "referral" in src_lower: return LeadSource.referral
    if "walk" in src_lower: return LeadSource.walk_in
    return LeadSource.other

@router.get("/view")
async def view_all_leads(db: Session = Depends(get_db)):
    leads = db.query(AMCLeadModel).all()
    return [
        {
            "id": lead.id,
            "lead_code": lead.lead_code,
            "name": lead.name,
            "phone": lead.phone,
            "location": lead.location,
            "requirement": lead.requirement,
            "status": lead.status,
            "source": lead.source,
            "priority": lead.priority,
            "created_at": lead.created_at
        }
        for lead in leads
    ]


@router.put("/update/{lead_id}")
async def update_lead(lead_id: int, update_data: AMCLeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if update_data.name is not None:
        lead.name = update_data.name
    if update_data.phone is not None:
        lead.phone = update_data.phone
    if update_data.requirements is not None:
        lead.requirement = update_data.requirements
    if update_data.priority is not None:
        lead.priority = update_data.priority
    if update_data.location is not None:
        lead.location = update_data.location
    if update_data.inquiry_source is not None:
        lead.source = map_source(update_data.inquiry_source)
        
    db.commit()
    db.refresh(lead)
    return lead

@router.delete("/delete/{lead_id}")
async def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"message": "Lead deleted successfully"}


@router.post("/Import_Leads_csv_amc")
async def import_leads_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        decoded = contents.decode("utf-8")
        reader = csv.reader(decoded.splitlines())
        
        try:
            next(reader)  # Skip header
        except StopIteration:
            raise HTTPException(status_code=400, detail="Empty CSV file")

        count = 0
        for row in reader:
            if not row or len(row) < 2:
                continue
            
            # CSV Format: Name, Phone, Location, Requirement, Source
            name = row[0]
            phone = row[1]
            location = row[2] if len(row) > 2 else ""
            requirement = row[3] if len(row) > 3 else ""
            source_str = row[4] if len(row) > 4 else "Meta Ad"

            lead_code = f"L{random.randint(1000, 9999)}"
            
            new_lead = AMCLeadModel(
                lead_code=lead_code,
                name=name,
                phone=phone,
                location=location,
                requirement=requirement,
                status=LeadStatus.new,
                source=map_source(source_str)
            )
            db.add(new_lead)
            count += 1

        db.commit()
        return {"message": f"Successfully imported {count} leads"}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error importing CSV: {str(e)}")
