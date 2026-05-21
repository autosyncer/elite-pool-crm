from fastapi import APIRouter, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from models import ProcurementModel
from database import get_db
from sqlalchemy import func
from datetime import date

router = APIRouter(prefix="/procurements", tags=["procurements"])

@router.get("/all")
async def get_all_procurements(db: Session = Depends(get_db)):
    procurements = db.query(ProcurementModel).order_by(ProcurementModel.logged_at.desc()).all()
    result = []
    for p in procurements:
        result.append({
            "id": p.id,
            "code": p.procurement_code,
            "client": p.client_name,
            "siteName": p.site_name,
            "siteType": p.site_type,
            "requirements": p.requirements,
            "date": p.logged_at,
            "status": p.status
        })
    return result

@router.put("/mark-done/{procurement_id}")
async def mark_procured(procurement_id: int, db: Session = Depends(get_db)):
    item = db.query(ProcurementModel).filter(ProcurementModel.id == procurement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Procurement item not found")
    
    item.status = "done"
    db.commit()
    
    # Trigger Procurement Done Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Procurement",
            action="Status Updated",
            message=f"Procurement request '{item.procurement_code}' has been marked as completed (Procured).",
            type="update",
            entity_id=str(item.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering procurement status updated notification:", e)

    return {"message": "Item marked as procured"}

@router.delete("/delete/{procurement_id}")
async def delete_procurement(procurement_id: int, db: Session = Depends(get_db)):
    item = db.query(ProcurementModel).filter(ProcurementModel.id == procurement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Procurement item not found")
    db.delete(item)
    db.commit()
    
    # Trigger Procurement Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Procurement",
            action="Item Deleted",
            message=f"Procurement item '{item.procurement_code}' has been deleted.",
            type="delete",
            entity_id=str(item.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering procurement deleted notification:", e)

    return {"message": "Procurement item deleted successfully"}

# Internal helper to add procurement from other routers
def create_procurement_entry(db: Session, client: str, site_name: str, site_type: str, requirements: str, source_id: int = None):
    last_entry = db.query(ProcurementModel).order_by(ProcurementModel.id.desc()).first()
    next_num = 1
    if last_entry and last_entry.procurement_code:
        parts = last_entry.procurement_code.split("-")
        if len(parts) == 2 and parts[0] == "PR":
            try:
                next_num = int(parts[1]) + 1
            except ValueError:
                pass

    while True:
        code = f"PR-{str(next_num).zfill(4)}"
        exists = db.query(ProcurementModel.id).filter(ProcurementModel.procurement_code == code).first()
        if not exists:
            break
        next_num += 1
    
    new_entry = ProcurementModel(
        procurement_code=code,
        client_name=client,
        site_name=site_name,
        site_type=site_type,
        requirements=requirements,
        source_id=source_id,
        status="pending"
    )
    db.add(new_entry)
    
    # Trigger Procurement Entry Added Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Procurement",
            action="Item Requested",
            message=f"New procurement request '{code}' generated for site '{site_name}'.",
            type="create",
            entity_id=code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering procurement requested notification:", e)
    # We don't commit here, let the calling route handle the commit
