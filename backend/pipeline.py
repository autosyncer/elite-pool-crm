from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from models import ConstructionLeadModel, AMCLeadModel, LeadStatus, PoolDesignModel, QuotationModel, CallLog, FollowupSchedule
from database import get_db

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

@router.get("/leads")
async def get_pipeline_leads(db: Session = Depends(get_db)):
    # Fetch Construction Leads
    c_leads = db.query(ConstructionLeadModel).all()
    # Fetch AMC Leads
    a_leads = db.query(AMCLeadModel).all()

    design = db.query(PoolDesignModel).all()
    quotes = db.query(QuotationModel).all()
    calls = db.query(CallLog).all()
    followups = db.query(FollowupSchedule).all()
    
    # Association key sets for instant lookup
    active_design_keys = {(d.lead_id, d.lead_type) for d in design if d.status and d.status.value == "in_progress"}
    pending_quote_keys = {q.lead_id for q in quotes if q.status and q.status.value == "pending"}
    sent_quote_keys = {q.lead_id for q in quotes if q.status and q.status.value == "sent"}
    followup_keys = {(f.lead_id, f.lead_type.value) for f in followups}

    result = []
    designs = []
    quotes_list = []
    calls_list = []

    for l in c_leads:
        status_val = l.status.value if l.status else "new"
        if status_val != "closed":
            if l.lead_code in pending_quote_keys:
                status_val = "quoted"
            elif (l.id, "construction") in active_design_keys:
                status_val = "design"
            elif (l.id, "construction") in followup_keys:
                status_val = "followup"
            else:
                status_val = "new"

        result.append({
            "id": l.lead_code,
            "db_id": l.id,
            "name": l.name,
            "loc": l.location,
            "src": l.source,
            "status": status_val,
            "type": "construction",
            "pri": "NORMAL" # You can add priority to your model later
        })
        
    for l in a_leads:
        status_val = l.status.value if l.status else "new"
        if status_val != "closed":
            if l.lead_code in pending_quote_keys:
                status_val = "quoted"
            elif (l.id, "amc") in active_design_keys:
                status_val = "design"
            elif (l.id, "amc") in followup_keys:
                status_val = "followup"
            else:
                status_val = "new"

        result.append({
            "id": l.lead_code,
            "db_id": l.id,
            "name": l.name,
            "loc": l.location,
            "src": l.source,
            "status": status_val,
            "type": "amc",
            "pri": "NORMAL"
        })

    for l in design:
        designs.append({
            "id": l.id,
            "lead_id": l.lead_id,
            "lead_type": l.lead_type,
            "pool_style": l.pool_style.value if l.pool_style else None,
            "assigned_designer": l.assigned_designer,
            "design_notes": l.design_notes,
            "status": l.status.value if l.status else None,
            "type": "design"
        })

    for l in quotes:
        quotes_list.append({
            "id": l.id,
            "lead_id": l.lead_id,
            "pool_length": l.pool_lenght,
            "pool_width": l.pool_width,
            "status": l.status.value if l.status else None,
            "pdf_url": l.pdf_url,
            "type": "quote"
        })

    for l in calls:
        calls_list.append({
            "id": l.id,
            "schedule_id": l.schedule_id,
            "call_number": l.call_number,
            "outcome": l.outcome.value if l.outcome else None,
            "duration": l.duration.value if l.duration else None,
            "agent_name": l.agent_name,
            "call_date": str(l.call_date) if l.call_date else None,
            "type": "call"
        })

    return {
        "leads": result,
        "designs": designs,
        "quotes": quotes_list,
        "calls": calls_list
    }


@router.put("/update-status")
async def update_lead_status(
    lead_code: str = Form(...),
    new_status: LeadStatus = Form(...),
    db: Session = Depends(get_db)
):
    # Try finding in Construction first
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.lead_code == lead_code).first()
    if not lead:
        # Try AMC
        lead = db.query(AMCLeadModel).filter(AMCLeadModel.lead_code == lead_code).first()
        
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    lead.status = new_status
    db.commit()
    return {"message": "Status updated successfully", "new_status": lead.status}

@router.delete("/delete/{lead_code}")
async def delete_lead_from_pipeline(lead_code: str, db: Session = Depends(get_db)):
    # Try finding in Construction first
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.lead_code == lead_code).first()
    if not lead:
        # Try AMC
        lead = db.query(AMCLeadModel).filter(AMCLeadModel.lead_code == lead_code).first()
        
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
        
    db.delete(lead)
    db.commit()
    return {"message": "Lead deleted successfully"}
