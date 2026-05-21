from fastapi import Depends, APIRouter, HTTPException, UploadFile, File
import csv
import random
from sqlalchemy.orm import Session
from database import get_db
from models import ConstructionLeadModel
from pydantic import BaseModel
from typing import Optional, Literal
from models import LeadStatus, LeadSource

class ConstructionLeadUpdate(BaseModel):
    requirements: Optional[str] = None
    priority: Optional[str] = None
    location: Optional[str] = None



router = APIRouter(prefix="/construction-leads", tags=["construction_leads"])



def map_source(src_str: str) -> LeadSource:
    src_lower = src_str.lower()
    if "meta" in src_lower: return LeadSource.meta_ad
    if "google" in src_lower: return LeadSource.google_ad
    if "referral" in src_lower: return LeadSource.referral
    if "walk" in src_lower: return LeadSource.walk_in
    return LeadSource.other


@router.get("/view")
async def view_all_leads(db: Session = Depends(get_db)):
    all_leads = db.query(ConstructionLeadModel).all()
    leads_list = [
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
        for lead in all_leads
    ]
    return leads_list


@router.put("/update/{lead_id}")
async def update_lead(lead_id: int, update_data: ConstructionLeadUpdate, db: Session = Depends(get_db)):
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    if update_data.requirements is not None:
        lead.requirement = update_data.requirements
    
    if update_data.priority is not None:
        lead.priority = update_data.priority

    if update_data.location is not None:
        lead.location = update_data.location
        
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/delete/{lead_id}")
async def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    db.commit()
    return {"message": "Lead deleted successfully"}
    


@router.post("/Import_Leads_csv_construction")
async def import_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    contents = await file.read()
    reader = csv.reader(contents.decode("utf-8").splitlines())
    next(reader)
    for row in reader:
        if not row or len(row) < 2:
            continue
        name = row[0] 
        phone = row[1]
        location = row[2] if len(row) > 2 else ""
        requirement = row[3] if len(row) > 3 else ""
        source_str = row[4] if len(row) > 4 else "Meta Ad"
        lead_code = f"L{random.randint(1000, 9999)}"
        new_lead = ConstructionLeadModel(
            lead_code=lead_code,
            name=name,
            phone=phone,
            location=location,
            requirement=requirement,
            status=LeadStatus.new,
            source=map_source(source_str)
        )
        db.add(new_lead)
    db.commit()
    return {"message": "Leads imported successfully"}