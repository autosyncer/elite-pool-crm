import os
import httpx
import zipfile
import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from database import get_db
from models import QuotationModel, QuotationStatus, ConstructionLeadModel, AMCLeadModel
from cloudinary_config import *
import cloudinary.uploader
import cloudinary.utils

router = APIRouter(prefix="/quotation", tags=["quotation"])


@router.post("/new_quotation")
async def new_quotation(
        lead_id: str = Form(...),
        pool_lenght: int = Form(...),
        pool_width: int = Form(...),
        quotation_pdf: UploadFile = File(...),
        db: Session = Depends(get_db)):

    pdf_url = None
    public_id = None
    if quotation_pdf and quotation_pdf.filename:
        try:
            # Use raw for PDF to fix MIME type issues
            result = cloudinary.uploader.upload(
                quotation_pdf.file,
                folder=f"elite-pool/quotations/{lead_id}",
                resource_type="raw",
            )
            pdf_url = result["secure_url"]
            public_id = result["public_id"]
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error uploading PDF: {str(e)}")

    new_q = QuotationModel(
        lead_id=lead_id,
        pool_lenght=pool_lenght,
        pool_width=pool_width,
        status=QuotationStatus.pending,
        pdf_url=pdf_url,
        public_id=public_id
    )
    db.add(new_q)
    db.commit()
    db.refresh(new_q)

    # Trigger Quotation Created Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Quotation Management",
            action="Quotation Created",
            message=f"New quotation of pool size {pool_lenght}x{pool_width} created for client '{lead_id}'.",
            type="create",
            entity_id=str(new_q.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering quotation created notification:", e)

    return {
        "message": "Quotation added successfully",
        "quotation": {
            "id": new_q.id,
            "lead_id": new_q.lead_id,
            "pool_lenght": new_q.pool_lenght,
            "pool_width": new_q.pool_width,
            "status": new_q.status.value,
            "pdf_url": new_q.pdf_url,
        }
    }


@router.get("/all_quotation")
async def all_quotation(db: Session = Depends(get_db)):
    try:
        quotations = db.query(QuotationModel).all()
        result = []
        for q in quotations:
            # Match lead_id (lead_code) to get the client name
            lead = db.query(ConstructionLeadModel).filter(ConstructionLeadModel.lead_code == q.lead_id).first()
            if not lead:
                lead = db.query(AMCLeadModel).filter(AMCLeadModel.lead_code == q.lead_id).first()
                
            result.append({
                "id": q.id,
                "lead_id": q.lead_id,
                "client_name": lead.name if lead else "Unknown",
                "pool_lenght": q.pool_lenght,
                "pool_width": q.pool_width,
                "status": q.status.value if hasattr(q.status, 'value') else q.status,
                "pdf_url": q.pdf_url,
                "created_at": str(q.created_at),
            })
        return result
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/file/{quotation_id}/quotation.pdf")
async def view_quotation_pdf(quotation_id: int, db: Session = Depends(get_db)):
    return await view_quotation(quotation_id, db)


@router.get("/file/{quotation_id}/view")
async def view_quotation(quotation_id: int, db: Session = Depends(get_db)):
    """Fetch quotation PDF from Cloudinary via archive API to bypass ACL."""
    q = db.query(QuotationModel).filter(QuotationModel.id == quotation_id).first()
    if not q or not q.public_id:
        raise HTTPException(status_code=404, detail="Quotation file not found")

    # Try both image and raw (depending on when it was uploaded)
    resp = None
    for res_type in ["raw", "image"]:
        archive_url = cloudinary.utils.download_archive_url(
            public_ids=[q.public_id],
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

    # Extract PDF from ZIP
    try:
        z = zipfile.ZipFile(io.BytesIO(resp.content))
        file_names = z.namelist()
        if not file_names:
            raise HTTPException(status_code=404, detail="No files in archive")
        file_content = z.read(file_names[0])
    except zipfile.BadZipFile:
        raise HTTPException(status_code=502, detail="Invalid archive from Cloudinary")

    return Response(
        content=file_content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="quotation_{q.lead_id}.pdf"'}
    )


@router.delete("/delete_quotation/{lead_code}")
async def delete_quotation(lead_code: str, db: Session = Depends(get_db)):
    quotation = db.query(QuotationModel).filter(QuotationModel.lead_id == lead_code).first()
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    
    # Delete from Cloudinary
    if quotation.public_id:
        try:
            # Try both resource types
            cloudinary.uploader.destroy(quotation.public_id, resource_type="raw")
            cloudinary.uploader.destroy(quotation.public_id, resource_type="image")
        except Exception:
            pass

    db.delete(quotation)
    db.commit()
    
    # Trigger Quotation Deleted Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Quotation Management",
            action="Quotation Deleted",
            message=f"Quotation for lead '{lead_code}' has been deleted.",
            type="delete",
            entity_id=lead_code,
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering quotation deleted notification:", e)

    return {"message": "Quotation deleted successfully"}


@router.patch("/{quotation_id}/done")
async def mark_quotation_sent(quotation_id: int, db: Session = Depends(get_db)):
    q = db.query(QuotationModel).filter(QuotationModel.id == quotation_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    q.status = QuotationStatus.sent
    db.commit()
    
    # Trigger Quotation Sent Notification
    try:
        from notifications import trigger_notification
        trigger_notification(
            db=db,
            module="Quotation Management",
            action="Quotation Sent",
            message=f"Quotation for client '{q.lead_id}' has been marked as Sent.",
            type="update",
            entity_id=str(q.id),
            actor_name="System"
        )
    except Exception as e:
        print("Error triggering quotation sent notification:", e)

    return {"message": "Quotation status updated to sent"}
