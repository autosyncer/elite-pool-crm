from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Literal
import random

from database import get_db
from models import ConstructionLeadModel, AMCLeadModel, LeadStatus, LeadSource
from notifications import trigger_notification

router = APIRouter(prefix="/add-leads", tags=["add_leads"])

class LeadCreate(BaseModel):
    name: str
    phone: str
    loc: str
    src: str = "Meta Ad"
    lt: Literal["construction", "amc"]
    req: str
    budget: List[str] = ["With Kids Pool","End-To-End","MEP"]
    pri: str = "Normal"
    notes: Optional[str] = ""

def map_source(src_str: str) -> LeadSource:
    src_lower = src_str.lower()
    if "meta" in src_lower: return LeadSource.meta_ad
    if "google" in src_lower: return LeadSource.google_ad
    if "referral" in src_lower: return LeadSource.referral
    if "walk" in src_lower: return LeadSource.walk_in
    return LeadSource.other

@router.post("/create")
async def create_lead(lead_data: LeadCreate, db: Session = Depends(get_db)):
    # Generate a random lead code
    lead_code = f"L{random.randint(1000, 9999)}"
    
    # Combine req, budget, pri, and notes into the single 'requirement' text field
    combined_req = lead_data.req
    if lead_data.pri: combined_req += f"\nPriority: {lead_data.pri}"
    if lead_data.budget: combined_req += f"\nExtras: {', '.join(lead_data.budget)}"
    if lead_data.notes: combined_req += f"\nNotes: {lead_data.notes}"

    mapped_source = map_source(lead_data.src)

    if lead_data.lt == "construction":
        new_lead = ConstructionLeadModel(
            lead_code=lead_code,
            name=lead_data.name,
            phone=lead_data.phone,
            location=lead_data.loc,
            requirement=combined_req,
            status=LeadStatus.new,
            source=mapped_source,
            priority=lead_data.pri
        )
    elif lead_data.lt == "amc":
        new_lead = AMCLeadModel(
            lead_code=lead_code,
            name=lead_data.name,
            phone=lead_data.phone,
            location=lead_data.loc,
            requirement=combined_req,
            status=LeadStatus.new,
            source=mapped_source,
            priority=lead_data.pri
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid lead type")

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)
    
    # Trigger Lead Creation Notification
    try:
        trigger_notification(
            db=db,
            module="Lead Management",
            action="Lead Created",
            message=f"New {lead_data.lt.capitalize()} Lead '{new_lead.name}' has been added.",
            type="create",
            entity_id=new_lead.lead_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering lead creation notification:", e)
    
    return {
        "message": f"Lead added successfully to {lead_data.lt}",
        "lead": {
            "id": new_lead.id,
            "lead_code": new_lead.lead_code,
            "name": new_lead.name,
            "leadType": lead_data.lt
        }
    }
