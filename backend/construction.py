from fastapi import APIRouter, Depends, HTTPException, Form, UploadFile, File, Response
import httpx
from sqlalchemy.orm import Session
from models import (
    ConstructionLeadModel,
    ConstructionSiteModel,
    ConstructionLogs,
    ConstructionLogPhotos,
    ConstructionSiteStatus,
    ConstructionPlanType,
    ConstructionPlan
)   
from database import get_db
from datetime import date
from sqlalchemy import func
import cloudinary.uploader
from cloudinary_config import * 
from typing import Optional, List
from procurement import create_procurement_entry



router = APIRouter(prefix="/construction", tags=["construction"])


@router.get("/all-sites")
async def get_all_sites(db: Session = Depends(get_db)):
    try:
        sites = db.query(ConstructionSiteModel).all()
        results = []
        for s in sites:
            try:
                # Join with lead to get name/location
                lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == s.lead_id).first()
                # Fetch current plans
                plans = db.query(ConstructionPlan).filter(ConstructionPlan.site_id == s.id).all()
                
                results.append({
                    "id": str(s.site_code) if s.site_code else str(s.id),
                    "db_id": s.id,
                    "site_code": s.site_code,
                    "client": getattr(lead, 'name', 'Unknown') if lead else "Unknown",
                    "location": getattr(lead, 'location', 'N/A') if lead else "N/A",
                    "phone": getattr(lead, 'phone', 'N/A') if lead else "N/A",
                    "leadId": getattr(lead, 'lead_code', 'N/A') if lead else "N/A",
                    "startDate": str(s.start_date) if s.start_date else "N/A",
                    "status": s.status if s.status else "active",
                    "plans": {p.plan_type: {"url": p.file_url, "id": p.id, "name": p.file_name} for p in plans if p.plan_type != 'other'} if plans else {},
                    "otherPlans": [{"url": p.file_url, "id": p.id, "name": p.file_name} for p in plans if p.plan_type == 'other'] if plans else []
                })
            except Exception as e:
                print(f"Error processing site {s.id}: {e}")
                results.append({
                    "id": str(s.site_code) if s.site_code else str(s.id),
                    "db_id": s.id,
                    "site_code": s.site_code,
                    "client": "Error Loading",
                    "location": "N/A",
                    "phone": "N/A",
                    "leadId": "N/A",
                    "startDate": "N/A",
                    "status": "active",
                    "plans": {},
                    "otherPlans": []
                })
        return results
    except Exception as e:
        print(f"Global error in get_all_sites: {e}")
        return []

@router.post("/add-construction-site")
async def add_construction_site(
    name: str = Form(...), 
    start_date: date = Form(...), 
    db: Session = Depends(get_db)
):
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.name == name).first()
    if not lead:
        raise HTTPException(status_code=404, detail=f"No construction lead found with name: {name}")

    # DUPLICATE CHECK: Prevent creating multiple sites for the same lead
    existing = db.query(ConstructionSiteModel).filter(ConstructionSiteModel.lead_id == lead.id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A site (Code: {existing.site_code}) already exists for this lead.")

    last_entry = db.query(ConstructionSiteModel).order_by(ConstructionSiteModel.id.desc()).first()
    next_num = 1
    if last_entry and last_entry.site_code:
        parts = last_entry.site_code.split("-")
        if len(parts) == 2 and parts[0] == "CS":
            try:
                next_num = int(parts[1]) + 1
            except ValueError:
                pass

    while True:
        new_site_code = f"CS-{str(next_num).zfill(3)}"
        exists = db.query(ConstructionSiteModel.id).filter(ConstructionSiteModel.site_code == new_site_code).first()
        if not exists:
            break
        next_num += 1

    new_site = ConstructionSiteModel(
        site_code=new_site_code,
        lead_id=lead.id,
        start_date=start_date,
        status=ConstructionSiteStatus.active
    )
    db.add(new_site)
    db.commit()
    db.refresh(new_site)
    
    # Trigger Construction Site Created Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Construction Management",
            action="Site Initialized",
            message=f"Construction site '{new_site_code}' initialized for lead '{name}'.",
            type="create",
            entity_id=new_site_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering site initialized notification:", e)

    return {"message": "Site initialized", "site_code": new_site.site_code}

@router.delete("/delete-site/{site_code}")
async def delete_construction_site(site_code: str, db: Session = Depends(get_db)):
    site = db.query(ConstructionSiteModel).filter(ConstructionSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    db.delete(site)
    db.commit()
    
    # Trigger Construction Site Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Construction Management",
            action="Site Deleted",
            message=f"Construction site '{site_code}' has been deleted.",
            type="delete",
            entity_id=site_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering site deleted notification:", e)

    return {"message": "Construction site deleted successfully"}


@router.post("/add-construction-logs")  
async def add_construction_logs(
    site_code: str = Form(...),
    labor_strength: str = Form(...),
    work_report: str = Form(...),
    materials_used: str = Form(...), # Parameter name can be anything
    procurement_req: str = Form(None),
    upload_images: List[UploadFile] = File([]),
    db: Session = Depends(get_db)
):
    # 1. Find the construction site by site_code
    site = db.query(ConstructionSiteModel).filter(ConstructionSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Construction site {site_code} not found")

    try:
        # 2. Create the main log entry (Matching your DB names exactly)
        new_log = ConstructionLogs(
            site_id=site.id,
            log_date=date.today(),
            labor_strenght=labor_strength, # DB name: labor_strenght
            work_report=work_report,
            materials_req=materials_used,   # DB name: materials_req
            procurement_req=procurement_req
        )
        db.add(new_log)
        db.flush()

        # NEW: Auto-add to Procurements if needed
        if procurement_req:
            # We need to fetch the lead details to get the client name
            lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == site.lead_id).first()
            
            create_procurement_entry(

                db=db,
                client=lead.name,
                site_name=f"{lead.name} Construction",
                site_type="construction",
                requirements=procurement_req,
                source_id=new_log.id
            )

        # 3. Upload images to Cloudinary (Organized into folders by site.id)
        for file in upload_images:
            if file.filename:
                # Determine correct resource type for Cloudinary
                file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
                res_type = 'image' if file_ext in ('jpg', 'jpeg', 'png', 'webp') else 'raw'
                
                # Define the destination folder
                log_folder = f"elite-pool/construction/logs/{site_code}"
                
                upload_result = cloudinary.uploader.upload(
                    file.file, 
                    folder=log_folder,
                    resource_type=res_type
                )
                image_url = upload_result.get("secure_url")
                public_id = upload_result.get("public_id")
                
                photo_entry = ConstructionLogPhotos(
                    log_id=new_log.id,
                    photo_url=image_url,
                    photo_name=file.filename,
                    public_id=public_id
                )
                db.add(photo_entry)

        db.commit()
        
        # Trigger Daily Log Submitted Notification
        try:
            from notifications import trigger_notification
            trigger_notification(
                db=db,
                module="Construction Management",
                action="Log Submitted",
                message=f"Daily progress log submitted for site '{site_code}' (Labor: {labor_strength}).",
                type="create",
                entity_id=site_code,
                actor_name="System"
            )
        except Exception as e:
            print("Error triggering log submitted notification:", e)

        return {"message": "Daily log saved successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/view-construction-logs/{site_code}")
async def view_construction_logs(
    site_code: str,
    log_date: Optional[date] = None, # Optional date filter

    db: Session = Depends(get_db)
):
    site = db.query(ConstructionSiteModel).filter(ConstructionSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Construction site {site_code} not found")
    
    # Start query
    query = db.query(ConstructionLogs).filter(ConstructionLogs.site_id == site.id)
    
    # Apply date filter if provided
    if log_date:
        query = query.filter(ConstructionLogs.log_date == log_date)
        
    logs = query.all()
    result = []
    for log in logs:
        result.append({
            "log_id": log.id,
            "site_id": log.site_id,
            "log_date": log.log_date,
            "labor_strength": log.labor_strenght,
            "work_report": log.work_report,
            "materials_used": log.materials_req,
            "procurement_req": log.procurement_req,
            "upload_images": [{"url": photo.photo_url, "name": photo.photo_name, "id": photo.id} for photo in log.photos]

        })
    return result

@router.post("/uploading_plans")
async def uploading_plans(
    site_code: str = Form(...),
    upload_plan_type : ConstructionPlanType = Form(...),
    upload_plans: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    site = db.query(ConstructionSiteModel).filter(ConstructionSiteModel.site_code == site_code).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Construction site {site_code} not found")
    try:
        # Upload plans to categorized folders by site.id
        for file in upload_plans:
            if file.filename:
                # Organize by plan type first, then by site_code
                plan_folder = f"elite-pool/construction/plans/{upload_plan_type.value}/{site_code}"
                
                # Determine correct resource type for Cloudinary (CAD/PDF need 'raw')
                file_ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
                res_type = 'image' if file_ext in ('jpg', 'jpeg', 'png', 'webp') else 'raw'

                upload_result = cloudinary.uploader.upload(
                    file.file, 
                    folder=plan_folder,
                    resource_type=res_type
                )
                upload_plan_url = upload_result.get("secure_url")
                public_id = upload_result.get("public_id")
                
                plan_entry = ConstructionPlan(
                    site_id=site.id,
                    file_url=upload_plan_url,
                    public_id=public_id,
                    file_name=file.filename,
                    plan_type=upload_plan_type,
                    updated_at=date.today()
                )
                db.add(plan_entry)
        db.commit()
        
        # Trigger Construction Plan Uploaded Notification
        try:
            from notifications import trigger_notification
            trigger_notification(
                db=db,
                module="Construction Management",
                action="Plan Uploaded",
                message=f"New '{upload_plan_type.value}' plan uploaded for site '{site_code}'.",
                type="create",
                entity_id=site_code,
                actor_name="System"
            )
        except Exception as e:
            print("Error triggering plan uploaded notification:", e)

        return {"message": "Plan uploaded successfully"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete-plan/{plan_id}")
async def delete_construction_plan(
    plan_id: int,
    db: Session = Depends(get_db)
):
    plan = db.query(ConstructionPlan).filter(ConstructionPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Construction plan {plan_id} not found")
    
    if plan.public_id:
        try:
            cloudinary.uploader.destroy(plan.public_id, resource_type="image")
            cloudinary.uploader.destroy(plan.public_id, resource_type="raw")
        except Exception as e:
            print(f"Error deleting from Cloudinary: {e}")

    db.delete(plan)
    db.commit()
    return {"message": "Construction plan deleted successfully"}

@router.get("/plan/{plan_id}/view")
async def view_plan(plan_id: int, db: Session = Depends(get_db)):
    plan = db.query(ConstructionPlan).filter(ConstructionPlan.id == plan_id).first()
    if not plan: raise HTTPException(status_code=404, detail="Plan not found")
    return await proxy_cloudinary_file(plan.public_id, plan.file_name)

@router.get("/log-photo/{photo_id}/view")
async def view_log_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(ConstructionLogPhotos).filter(ConstructionLogPhotos.id == photo_id).first()
    if not photo: raise HTTPException(status_code=404, detail="Photo not found")
    return await proxy_cloudinary_file(photo.public_id, photo.photo_name)

async def proxy_cloudinary_file(public_id: str, file_name: str):
    if not public_id:
        raise HTTPException(status_code=400, detail="Missing public ID for file")
    
    ext = file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else 'pdf'
    resp = None
    # Try different resource types
    for res_type in ["image", "raw"]:
        archive_url = cloudinary.utils.download_archive_url(
            public_ids=[public_id],
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
        if not names: raise HTTPException(status_code=404, detail="Empty archive")
        content = z.read(names[0])
    except Exception: raise HTTPException(status_code=502, detail="Invalid archive")

    content_types = {'pdf': 'application/pdf', 'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg'}
    return Response(
        content=content,
        media_type=content_types.get(ext, 'application/octet-stream'),
        headers={"Content-Disposition": f'inline; filename="{file_name}"'}
    )

    
