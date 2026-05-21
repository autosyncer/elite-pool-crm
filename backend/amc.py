from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Response
import httpx
from sqlalchemy.orm import Session
from models import (
    AMCLeadModel,
    AmcSiteModel,
    AmcVisitModel,
    AmcVisitPhotoModel
)   
from database import get_db
from datetime import date
from sqlalchemy import func
import cloudinary.uploader
from cloudinary_config import * 
from typing import List, Optional
from procurement import create_procurement_entry


router = APIRouter(prefix="/amc", tags=["amc"])

@router.get("/all-sites")
async def get_all_amc_sites(db: Session = Depends(get_db)):
    sites = db.query(AmcSiteModel).all()
    result = []
    for s in sites:
        lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == s.lead_id).first()
        result.append({
            "id": s.id,
            "site_code": s.site_code,
            "client": lead.name if lead else "N/A",
            "location": lead.location if lead else "N/A",
            "phone": lead.phone if lead else "N/A",
            "leadId": lead.lead_code if lead else "N/A",
            "startDate": s.start_date,
            "status": s.status
        })
    return result

@router.post("/add-amc-site")
async def add_amc_site(
    name: str = Form(...), 
    start_date: date = Form(...), 
    db: Session = Depends(get_db)
):
    lead = db.query(AMCLeadModel).filter(AMCLeadModel.name == name).first()
    if not lead:
        raise HTTPException(status_code=404, detail="AMC lead not found")

    # DUPLICATE CHECK
    existing = db.query(AmcSiteModel).filter(AmcSiteModel.lead_id == lead.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"AMC contract (Code: {existing.site_code}) already exists for this lead.")

    last_entry = db.query(AmcSiteModel).order_by(AmcSiteModel.id.desc()).first()
    next_num = 1
    if last_entry and last_entry.site_code:
        parts = last_entry.site_code.split("-")
        if len(parts) == 2 and parts[0] == "AMC":
            try:
                next_num = int(parts[1]) + 1
            except ValueError:
                pass

    while True:
        new_site_code = f"AMC-{str(next_num).zfill(3)}"
        exists = db.query(AmcSiteModel.id).filter(AmcSiteModel.site_code == new_site_code).first()
        if not exists:
            break
        next_num += 1

    new_site = AmcSiteModel(
        site_code=new_site_code,
        lead_id=lead.id,
        start_date=start_date,
        status="active"
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    
    # Trigger AMC Site Created Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="AMC Management",
            action="Site Initialized",
            message=f"AMC site '{new_site_code}' initialized for lead '{name}'.",
            type="create",
            entity_id=new_site_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering AMC site initialized notification:", e)

    return {"message": "AMC Site initialized", "site_code": new_site.site_code}


@router.post("/add-amc-visit")  
async def add_amc_visit(
    site_code: str = Form(...),
    visit_date: date = Form(...),
    ph_level: str = Form(None),
    cl_level: str = Form(None),
    service_report: str = Form(...),
    materials_used: str = Form(None),
    procurement_req: str = Form(None),
    upload_images: List[UploadFile] = File([]),
    db: Session = Depends(get_db)
):
    site = db.query(AmcSiteModel).filter(AmcSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"AMC site {site_code} not found")

    try:
        new_visit = AmcVisitModel(
            site_id=site.id,
            visit_date=visit_date,
            ph_level=ph_level,
            cl_level=cl_level,
            service_report=service_report,
            materials_used=materials_used,
            procurement_req=procurement_req
        )
        db.add(new_visit)
        db.flush()

        # NEW: Auto-add to Procurements if needed
        if procurement_req:
            # Get lead for client name
            lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == site.lead_id).first()
            create_procurement_entry(
                db=db,
                client=lead.name if lead else "Unknown",
                site_name=f"{lead.name if lead else 'Site'} AMC",
                site_type="amc",
                requirements=procurement_req,
                source_id=new_visit.id
            )

        for file in upload_images:
            if file.filename:
                # Organize by site_code
                log_folder = f"elite-pool/amc/logs/{site_code}"
                upload_result = cloudinary.uploader.upload(
                    file.file, 
                    folder=log_folder
                )
                image_url = upload_result.get("secure_url")
                public_id = upload_result.get("public_id")
                
                photo_entry = AmcVisitPhotoModel(
                    visit_id=new_visit.id,
                    photo_url=image_url,
                    photo_name=file.filename,
                    public_id=public_id
                )
                db.add(photo_entry)

        db.commit()
        
        # Trigger AMC Visit Logged Notification
        try:
            from notifications import trigger_notification
            trigger_notification(
                db=db,
                module="AMC Management",
                action="Visit Logged",
                message=f"AMC maintenance visit logged for site '{site_code}' on {visit_date}.",
                type="create",
                entity_id=site_code,
                actor_name="System"
            )
        except Exception as e:
            print("Error triggering AMC visit logged notification:", e)

        return {"message": "AMC visit log saved successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/view-amc-visits/{site_code}")
async def view_amc_visits(
    site_code: str,
    db: Session = Depends(get_db)
):
    site = db.query(AmcSiteModel).filter(AmcSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"AMC site {site_code} not found")
    
    visits = db.query(AmcVisitModel).filter(AmcVisitModel.site_id == site.id).order_by(AmcVisitModel.visit_date.desc()).all()
    result = []
    for v in visits:
        result.append({
            "id": v.id,
            "date": v.visit_date,
            "ph": v.ph_level,
            "cl": v.cl_level,
            "report": v.service_report,
            "materials": v.materials_used,
            "requirements": v.procurement_req,
            "photos": [{"url": p.photo_url, "name": p.photo_name, "id": p.id} for p in v.photos]
        })
    return result

@router.get("/visit-photo/{photo_id}/view")
async def view_visit_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(AmcVisitPhotoModel).filter(AmcVisitPhotoModel.id == photo_id).first()
    if not photo: raise HTTPException(status_code=404, detail="Photo not found")
    
    ext = photo.photo_name.rsplit('.', 1)[-1].lower() if photo.photo_name and '.' in photo.photo_name else 'jpg'
    resp = None
    for res_type in ["image", "raw"]:
        archive_url = cloudinary.utils.download_archive_url(
            public_ids=[photo.public_id],
            resource_type=res_type,
            flatten_folders=True
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(archive_url, follow_redirects=True)
                if resp.status_code == 200: break
        except Exception: continue

    if resp is None:
        raise HTTPException(status_code=502, detail="Failed to connect to Cloudinary")
    if resp.status_code != 200:
        if resp.status_code == 400 and "Missing public_ids" in resp.text:
            raise HTTPException(status_code=404, detail="File not found on Cloudinary. The file may have been deleted or the database record is stale.")
        raise HTTPException(status_code=502, detail=f"Failed to fetch file from Cloudinary (Status {resp.status_code})")

    import zipfile, io
    try:
        z = zipfile.ZipFile(io.BytesIO(resp.content))
        names = z.namelist()
        content = z.read(names[0])
    except Exception: raise HTTPException(status_code=502, detail="Invalid archive")

    content_types = {'pdf': 'application/pdf', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg'}
    return Response(
        content=content,
        media_type=content_types.get(ext, 'application/octet-stream'),
        headers={"Content-Disposition": f'inline; filename="{photo.photo_name}"'}
    )

@router.delete("/delete-site/{site_code}")
async def delete_amc_site(site_code: str, db: Session = Depends(get_db)):
    site = db.query(AmcSiteModel).filter(AmcSiteModel.site_code == site_code).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
    db.delete(site)
    db.commit()
    
    # Trigger AMC Site Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="AMC Management",
            action="Site Deleted",
            message=f"AMC site '{site_code}' has been deleted.",
            type="delete",
            entity_id=site_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering AMC site deleted notification:", e)

    return {"message": "AMC site deleted successfully"}

@router.delete("/delete-visit/{visit_id}")
async def delete_amc_visit(visit_id: int, db: Session = Depends(get_db)):
    visit = db.query(AmcVisitModel).filter(AmcVisitModel.id == visit_id).first()
    if not visit: raise HTTPException(status_code=404, detail="Visit log not found")
    
    # Delete photos from Cloudinary
    for photo in visit.photos:
        if photo.public_id:
            try:
                cloudinary.uploader.destroy(photo.public_id, resource_type="image")
                cloudinary.uploader.destroy(photo.public_id, resource_type="raw")
            except Exception: pass
            
    db.delete(visit)
    db.commit()
    
    # Trigger AMC Visit Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="AMC Management",
            action="Visit Deleted",
            message=f"AMC visit log ID {visit_id} has been deleted.",
            type="delete",
            entity_id=str(visit_id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering AMC visit deleted notification:", e)

    return {"message": "AMC visit log deleted successfully"}
