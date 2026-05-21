from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import ClientReview, FollowupLeadType, ConstructionLeadModel, AMCLeadModel, CallLog, FollowupSchedule
from typing import List

router = APIRouter(prefix="/review", tags=["Review"])

@router.post("/client-review")
async def add_or_update_client_review(
    lead_type: FollowupLeadType = Form(...),
    lead_code: str = Form(...),  # Changed from lead_id (int) to lead_code (str)
    rating: int = Form(...),
    feedback_note: str = Form(...),
    db: Session = Depends(get_db)
):
    try:
        # 1. Resolve lead_code to the actual database lead_id (integer)
        lead = None
        if lead_type == FollowupLeadType.construction:
            lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.lead_code == lead_code).first()
        elif lead_type == FollowupLeadType.amc:
            lead = db.query(AMCLeadModel).filter(AMCLeadModel.lead_code == lead_code).first()

        if not lead:
            raise HTTPException(status_code=404, detail=f"Lead with code {lead_code} not found in {lead_type}")

        # 2. Check if a review already exists for this lead_id
        existing_review = db.query(ClientReview).filter(
            ClientReview.lead_id == lead.id,
            ClientReview.lead_type == lead_type
        ).first()

        if existing_review:
            # Update existing
            existing_review.rating = rating
            existing_review.feedback_note = feedback_note
        else:
            # Create new
            new_review = ClientReview(
                lead_type=lead_type,
                lead_id=lead.id,
                rating=rating,
                feedback_note=feedback_note
            )
            db.add(new_review)
        
        db.commit()
        return {"message": f"Review for {lead_code} saved successfully"}
    except HTTPException as he:
        raise he
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/all-reviews")
async def get_all_reviews(db: Session = Depends(get_db)):
    """
    Fetches all reviews and joins with Construction/AMC tables 
    to provide the client name and phone for the UI cards.
    """
    reviews = db.query(ClientReview).all()
    results = []

    for r in reviews:
        client_info = None
        l_code = "Unknown"
        if r.lead_type == FollowupLeadType.construction:
            client_info = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == r.lead_id).first()
        elif r.lead_type == FollowupLeadType.amc:
            client_info = db.query(AMCLeadModel).filter(AMCLeadModel.id == r.lead_id).first()

        if client_info:
            l_code = client_info.lead_code

        results.append({
            "id": r.id,
            "lead_id": r.lead_id,
            "lead_code": l_code,
            "lead_type": r.lead_type,
            "name": client_info.name if client_info else "Unknown",
            "phone": client_info.phone if client_info else "N/A",
            "rating": r.rating,
            "feedback_note": r.feedback_note,
            "updated_at": r.updated_at
        })
    
    return results
@router.get("/eligible-clients")
async def get_eligible_clients(db: Session = Depends(get_db)):
    """
    Returns clients from FollowupSchedule who have at least ONE log in CallLog.
    Used by the 'Add Review' modal.
    """
    # 1. Find all schedule IDs that have at least one call
    subquery = db.query(CallLog.schedule_id).distinct().subquery()
    
    # 2. Get the schedules
    schedules = db.query(FollowupSchedule).filter(FollowupSchedule.id.in_(subquery)).all()
    
    results = []
    for s in schedules:
        l_code = "Unknown"
        if s.lead_type == FollowupLeadType.construction:
            lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == s.lead_id).first()
        else:
            lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == s.lead_id).first()
        
        if lead:
            l_code = lead.lead_code
            
        results.append({
            "lead_id": s.lead_id,
            "lead_code": l_code,
            "lead_type": s.lead_type,
            "name": s.client_name,
            "phone": s.phone
        })
    return results
