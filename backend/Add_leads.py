from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Literal
import re

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
    lead_code: Optional[str] = None


@router.get("/next-code/{lead_type}")
async def next_lead_code(lead_type: str, db: Session = Depends(get_db)):
    """Return next sequential lead code like EPB-C-001 or EPB-A-001."""
    prefix = "EPB-C" if lead_type == "construction" else "EPB-A"
    Model = ConstructionLeadModel if lead_type == "construction" else AMCLeadModel
    all_codes = [r.lead_code for r in db.query(Model.lead_code).all()]
    max_num = 0
    for code in all_codes:
        c = str(code or '')
        # Only count codes that start with EPB- prefix (ignore old random L-codes)
        if not c.upper().startswith('EPB-'):
            continue
        m = re.search(r'(\d+)$', c)
        if m:
            max_num = max(max_num, int(m.group(1)))
    return {"lead_code": f"{prefix}-{max_num + 1:03d}"}

def map_source(src_str: str) -> LeadSource:
    src_lower = src_str.lower()
    if "meta" in src_lower: return LeadSource.meta_ad
    if "google" in src_lower: return LeadSource.google_ad
    if "referral" in src_lower: return LeadSource.referral
    if "walk" in src_lower: return LeadSource.walk_in
    return LeadSource.other

@router.post("/create")
async def create_lead(lead_data: LeadCreate, db: Session = Depends(get_db)):
    # Use provided lead_code or auto-generate sequential one
    if lead_data.lead_code and lead_data.lead_code.strip():
        lead_code = lead_data.lead_code.strip()
    else:
        prefix = "EPB-C" if lead_data.lt == "construction" else "EPB-A"
        Model = ConstructionLeadModel if lead_data.lt == "construction" else AMCLeadModel
        all_codes = [r.lead_code for r in db.query(Model.lead_code).all()]
        max_num = 0
        for code in all_codes:
            c = str(code or '')
            if not c.upper().startswith('EPB-'):
                continue
            m = re.search(r'(\d+)$', c)
            if m:
                max_num = max(max_num, int(m.group(1)))
        lead_code = f"{prefix}-{max_num + 1:03d}"
    
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
