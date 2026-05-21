from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
import httpx
from database import get_db
from sqlalchemy.orm import Session
from models import PoolDesignModel, PoolDesignFileModel, PoolStyle, ConstructionLeadModel, AMCLeadModel
from typing import Optional
import cloudinary.uploader
from cloudinary_config import *  # initializes Cloudinary

router = APIRouter(prefix="/pool-design", tags=["pool_design"])


@router.post("/new-design")
async def new_design(
    lead_code: str = Form(...),
    pool_style: PoolStyle = Form(...),
    assigned_designer: str = Form(...),
    design_notes: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),):

    # 1. Verify the lead exists by lead_code (e.g. "L1254")
    lead_type = 'construction'
    lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.lead_code == lead_code).first()
    if not lead:
        lead = db.query(AMCLeadModel).filter(AMCLeadModel.lead_code == lead_code).first()
        lead_type = 'amc'
        
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead '{lead_code}' not found")

    # 2. Create the design plan in PostgreSQL
    design = PoolDesignModel(
        lead_id=lead.id,
        lead_type=lead_type,
        pool_style=pool_style,
        assigned_designer=assigned_designer,
        design_notes=design_notes,
    )
    db.add(design)
    db.commit()
    db.refresh(design)

    # 3. If a file was uploaded, send it to Cloudinary
    file_data = None
    if file and file.filename:
        # Validate file type
        allowed_types = (".pdf", ".dwg", ".jpg", ".jpeg", ".png")
        if not file.filename.lower().endswith(allowed_types):
            raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {allowed_types}")

        try:
            # Upload to Cloudinary
            # Determine correct resource type for Cloudinary
            file_ext = file.filename.rsplit('.', 1)[-1].lower()
            res_type = 'image' if file_ext in ('jpg', 'jpeg', 'png') else 'raw'

            result = cloudinary.uploader.upload(
                file.file,
                folder=f"elite-pool/designs/{design.id}",
                resource_type=res_type,
            )

            # Save file metadata to PostgreSQL
            design_file = PoolDesignFileModel(
                design_id=design.id,
                file_url=result["secure_url"],
                public_id=result.get("public_id"),
                file_name=file.filename,
                file_type=file.filename.rsplit(".", 1)[-1].lower(),
                version=1,
            )
            db.add(design_file)
            db.commit()
            db.refresh(design_file)

            file_data = {
                "file_id": design_file.id,
                "file_url": design_file.file_url,
                "file_name": design_file.file_name,
            }

        except Exception as e:
            db.rollback() # Rollback design creation if file save fails to keep DB clean
            raise HTTPException(status_code=500, detail=f"File processing failed: {str(e)}")

    # Trigger Design Created Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Design Management",
            action="Design Created",
            message=f"New design assigned to '{assigned_designer}' for client '{lead.name}'.",
            type="create",
            entity_id=str(design.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering design created notification:", e)

    return {
        "message": "Design plan created successfully",
        "design": {
            "id": design.id,
            "lead_id": design.lead_id,
            "lead_code": lead_code,
            "client_name": lead.name,
            "pool_style": design.pool_style.value if hasattr(design.pool_style, 'value') else design.pool_style,
            "assigned_designer": design.assigned_designer,
            "design_notes": design.design_notes,
            "status": design.status.value if hasattr(design.status, 'value') else design.status,
        },
        "file": file_data,
    }



@router.get("/all")
async def get_all_designs(db: Session = Depends(get_db)):
    designs = db.query(PoolDesignModel).all()
    result = []
    for d in designs:
        if d.lead_type == 'amc':
            lead = db.query(AMCLeadModel).filter(AMCLeadModel.id == d.lead_id).first()
        else:
            lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.id == d.lead_id).first()
            
        files = db.query(PoolDesignFileModel).filter(PoolDesignFileModel.design_id == d.id).all()
        result.append({
            "id": d.id,
            "lead_id": d.lead_id,
            "lead_type": d.lead_type,
            "lead_code": lead.lead_code if lead else None,
            "client_name": lead.name if lead else "Unknown",
            "requirement": lead.requirement if lead else "",
            "pool_style": d.pool_style.value if hasattr(d.pool_style, 'value') else d.pool_style,
            "assigned_designer": d.assigned_designer,
            "design_notes": d.design_notes,
            "status": d.status.value if hasattr(d.status, 'value') else d.status,
            "created_at": str(d.created_at),
            "files": [{"id": f.id, "file_url": f.file_url, "file_name": f.file_name, "version": f.version} for f in files],
        })
    return result



@router.patch("/{design_id}/done")
async def mark_done(design_id: int, db: Session = Depends(get_db)):
    design = db.query(PoolDesignModel).filter(PoolDesignModel.id == design_id).first()
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    design.status = "completed"
    db.commit()
    
    # Trigger Design Completed Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Design Management",
            action="Design Completed",
            message=f"Design for client '{design_id}' has been marked as Completed.",
            type="update",
            entity_id=str(design.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering design completed notification:", e)

    return {"message": "Design marked as complete"}


@router.patch("/revision/{client_name}")
async def revision(
    client_name: str,
    pool_style: Optional[str] = Form(None),
    assigned_designer: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    lead_type = 'construction'
    # Try searching by lead_code first, then by name
    lead = db.query(ConstructionLeadModel).filter(
        (ConstructionLeadModel.lead_code == client_name) | (ConstructionLeadModel.name == client_name)
    ).first()
    
    if not lead:
        lead = db.query(AMCLeadModel).filter(
            (AMCLeadModel.lead_code == client_name) | (AMCLeadModel.name == client_name)
        ).first()
        lead_type = 'amc'
        
    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead '{client_name}' not found")
    design = db.query(PoolDesignModel).filter(PoolDesignModel.lead_id == lead.id, PoolDesignModel.lead_type == lead_type).first()
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
        
    if pool_style:
        # Normalize style to match enum (e.g., "Infinity Edge" -> "infinity_edge")
        design.pool_style = pool_style.lower().replace(' ', '_').replace('-', '_')
    if assigned_designer:
        design.assigned_designer = assigned_designer
        
    file_data = None
    if file and file.filename:
        # Validate file type
        allowed_types = (".pdf", ".dwg", ".jpg", ".jpeg", ".png")
        if not file.filename.lower().endswith(allowed_types):
            raise HTTPException(status_code=400, detail=f"File type not allowed. Accepted: {allowed_types}")

        try:
            # Determine correct resource type for Cloudinary
            file_ext = file.filename.rsplit('.', 1)[-1].lower()
            res_type = 'image' if file_ext in ('jpg', 'jpeg', 'png') else 'raw'

            result = cloudinary.uploader.upload(
                file.file,
                folder=f"elite-pool/designs/{design.id}",
                resource_type=res_type,
            )

            # Get the latest version number from existing files
            from sqlalchemy import func as sa_func
            latest_version = db.query(sa_func.max(PoolDesignFileModel.version)).filter(
                PoolDesignFileModel.design_id == design.id
            ).scalar() or 0

            # Save file metadata to PostgreSQL
            design_file = PoolDesignFileModel(
                design_id=design.id,
                file_url=result["secure_url"],
                public_id=result.get("public_id"),
                file_name=file.filename,
                file_type=file.filename.rsplit(".", 1)[-1].lower(),
                version=latest_version + 1,
            )
            db.add(design_file)
            db.commit()
            db.refresh(design_file)

            file_data = {
                "file_id": design_file.id,
                "file_url": design_file.file_url,
                "file_name": design_file.file_name,
            }

        except Exception as e:
            # Design was saved, but file upload failed — don't lose the design
            raise HTTPException(status_code=500, detail=f"Design saved but file upload failed: {str(e)}")

    # Trigger Design Revision Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Design Management",
            action="Design Revision",
            message=f"New revision submitted for client '{lead.name}'.",
            type="update",
            entity_id=str(design.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering design revision notification:", e)

    return {
        "message": "Revision submitted successfully",
        "design": {
            "id": design.id,
            "lead_id": design.lead_id,
            "lead_code": lead.lead_code,
            "client_name": lead.name,
            "pool_style": design.pool_style.value if hasattr(design.pool_style, 'value') else design.pool_style,
            "assigned_designer": design.assigned_designer,
            "design_notes": design.design_notes,
            "status": design.status.value if hasattr(design.status, 'value') else design.status,
        },
        "file": file_data,
    }


@router.get("/details/{client_name}")
async def get_details(client_name: str, db: Session = Depends(get_db)):
    # Try construction first, then AMC
    lead_type = 'construction'
    lead = db.query(ConstructionLeadModel).filter(
        (ConstructionLeadModel.name == client_name) | (ConstructionLeadModel.lead_code == client_name)
    ).first()
    if not lead:
        lead = db.query(AMCLeadModel).filter(
            (AMCLeadModel.name == client_name) | (AMCLeadModel.lead_code == client_name)
        ).first()
        lead_type = 'amc'

    if not lead:
        raise HTTPException(status_code=404, detail=f"Lead '{client_name}' not found")

    design = db.query(PoolDesignModel).filter(
        PoolDesignModel.lead_id == lead.id, PoolDesignModel.lead_type == lead_type
    ).first()
    if not design:
        raise HTTPException(status_code=404, detail="Design not found for this lead")

    files = db.query(PoolDesignFileModel).filter(PoolDesignFileModel.design_id == design.id).all()

    return {
        "id": design.id,
        "lead_id": lead.id,
        "lead_code": lead.lead_code,
        "client_name": lead.name,
        "requirement": lead.requirement,
        "pool_style": design.pool_style.value if hasattr(design.pool_style, 'value') else design.pool_style,
        "assigned_designer": design.assigned_designer,
        "design_notes": design.design_notes,
        "status": design.status.value if hasattr(design.status, 'value') else design.status,
        "created_at": str(design.created_at),
        "files": [{"id": f.id, "file_url": f.file_url, "file_name": f.file_name, "version": f.version} for f in files],
    }


@router.get("/file/{file_id}/design_plan.pdf")
async def view_file_pdf(file_id: int, db: Session = Depends(get_db)):
    return await view_file(file_id, db)


@router.get("/file/{file_id}/view")
async def view_file(file_id: int, db: Session = Depends(get_db)):
    """Fetch file from Cloudinary via archive API and serve with correct headers."""
    design_file = db.query(PoolDesignFileModel).filter(PoolDesignFileModel.id == file_id).first()
    if not design_file:
        raise HTTPException(status_code=404, detail="File not found")

    ext = design_file.file_name.rsplit('.', 1)[-1].lower() if '.' in design_file.file_name else 'pdf'

    # Use Cloudinary's archive API (the only method that bypasses ACL restrictions)
    # Try 'image' first (old uploads), then 'raw' (new PDF uploads)
    resp = None
    for res_type in ["image", "raw"]:
        archive_url = cloudinary.utils.download_archive_url(
            public_ids=[design_file.public_id],
            resource_type=res_type,
            flatten_folders=True
        )
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(archive_url, follow_redirects=True)
                if resp.status_code == 200:
                    break
        except Exception:
            continue

    if resp is None:
        raise HTTPException(status_code=502, detail="Failed to connect to Cloudinary")
    if resp.status_code != 200:
        if resp.status_code == 400 and "Missing public_ids" in resp.text:
            raise HTTPException(status_code=404, detail="File not found on Cloudinary. The file may have been deleted or the database record is stale.")
        raise HTTPException(status_code=502, detail=f"Failed to fetch file from Cloudinary (Status {resp.status_code})")

    # Extract the file from the ZIP
    import zipfile, io
    try:
        z = zipfile.ZipFile(io.BytesIO(resp.content))
        file_names = z.namelist()
        if not file_names:
            raise HTTPException(status_code=404, detail="No files in archive")
        file_content = z.read(file_names[0])
    except zipfile.BadZipFile:
        raise HTTPException(status_code=502, detail="Invalid archive from Cloudinary")

    content_types = {
        'pdf': 'application/pdf', 'png': 'image/png',
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    }

    return Response(
        content=file_content,
        media_type=content_types.get(ext, 'application/octet-stream'),
        headers={"Content-Disposition": f'inline; filename="{design_file.file_name}"'}
    )


@router.delete("/file/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_db)):
    """Delete a single design file from Cloudinary and database."""
    design_file = db.query(PoolDesignFileModel).filter(PoolDesignFileModel.id == file_id).first()
    if not design_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Delete from Cloudinary
    if design_file.public_id:
        try:
            cloudinary.uploader.destroy(design_file.public_id, resource_type="image")
        except Exception:
            pass  # Continue even if Cloudinary delete fails

    # Delete from database
    db.delete(design_file)
    db.commit()

    return {"message": f"File '{design_file.file_name}' deleted successfully"}

@router.delete("/{design_id}")
async def delete_design(design_id: int, db: Session = Depends(get_db)):
    design = db.query(PoolDesignModel).filter(PoolDesignModel.id == design_id).first()
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")

    # Delete files from Cloudinary first
    files = db.query(PoolDesignFileModel).filter(PoolDesignFileModel.design_id == design_id).all()
    for f in files:
        if f.public_id:
            try:
                cloudinary.uploader.destroy(f.public_id)
            except Exception:
                pass  

    db.delete(design)
    db.commit()
    
    # Trigger Design Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Design Management",
            action="Design Deleted",
            message=f"Design plan for ID {design_id} has been deleted.",
            type="delete",
            entity_id=str(design_id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering design deleted notification:", e)

    return {"message": "Design and files deleted successfully"}