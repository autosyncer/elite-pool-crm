from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import get_db
from models import BackupLogModel
from datetime import datetime
import json, io

router = APIRouter(prefix="/backup", tags=["backup"])

APP_NAME = "ElitePoolCRM"

EXPORT_ORDER = [
    'users', 'vendors', 'construction_leads', 'amc_leads',
    'pool_designs', 'design_files', 'quotations', 'attendence',
    'm2a_accounts', 'm2a_payments', 'm2a_expenditures',
    'ep_accounts', 'ep_payments', 'ep_expenditures', 'ep_invoices',
    'office_expenses', 'followup_schedule', 'followup_calls',
    'agent_daily_stats', 'client_reviews',
    'construction_sites', 'construction_plans', 'construction_logs',
    'construction_log_photos', 'amc_sites', 'amc_visits', 'amc_visit_photos',
    'procurements', 'salary_history', 'staff_profiles',
    'inventory', 'notifications',
]

RESTORE_ORDER = [
    'users', 'vendors', 'construction_leads', 'amc_leads',
    'pool_designs', 'm2a_accounts', 'ep_accounts', 'followup_schedule',
    'construction_sites', 'amc_sites', 'quotations', 'attendence',
    'office_expenses', 'staff_profiles', 'salary_history',
    'client_reviews', 'agent_daily_stats', 'procurements',
    'design_files', 'm2a_payments', 'm2a_expenditures',
    'ep_payments', 'ep_expenditures', 'ep_invoices',
    'followup_calls', 'construction_plans', 'construction_logs',
    'construction_log_photos', 'amc_visits', 'amc_visit_photos',
    'inventory', 'notifications',
]

TRUNCATE_ORDER = [
    'notifications', 'inventory', 'construction_log_photos',
    'amc_visit_photos', 'construction_logs', 'amc_visits',
    'construction_plans', 'design_files', 'ep_invoices',
    'ep_payments', 'ep_expenditures', 'm2a_payments', 'm2a_expenditures',
    'followup_calls', 'agent_daily_stats', 'client_reviews',
    'salary_history', 'staff_profiles', 'procurements',
    'office_expenses', 'attendence', 'quotations',
    'ep_accounts', 'm2a_accounts', 'construction_sites',
    'amc_sites', 'followup_schedule', 'amc_leads',
    'construction_leads', 'pool_designs', 'vendors', 'users',
]


def _serialize(row) -> dict:
    d = dict(row._mapping)
    for k, v in d.items():
        if hasattr(v, 'isoformat'):
            d[k] = v.isoformat()
        elif hasattr(v, '__class__') and v.__class__.__name__ == 'Decimal':
            d[k] = float(v)
    return d


@router.get("/export")
async def export_backup(
    tables: str = None,
    backup_type: str = "manual",
    db: Session = Depends(get_db),
):
    selected = [t.strip() for t in tables.split(',')] if tables else EXPORT_ORDER
    selected = [t for t in selected if t in EXPORT_ORDER]

    now = datetime.utcnow()
    filename = f"{APP_NAME}_Backup_{now.strftime('%Y-%m-%d_%H%M')}.json"

    backup_data: dict = {
        "backup_version": "1.0",
        "backup_type": backup_type,
        "created_at": now.isoformat(),
        "app_name": APP_NAME,
        "tables": {},
    }

    for table in selected:
        try:
            rows = db.execute(text(f'SELECT * FROM "{table}" ORDER BY id ASC')).fetchall()
            records = [_serialize(r) for r in rows]
            backup_data["tables"][table] = {"count": len(records), "records": records}
        except Exception as e:
            backup_data["tables"][table] = {"count": 0, "records": [], "error": str(e)}

    raw = json.dumps(backup_data, indent=2, default=str).encode("utf-8")
    size_kb = round(len(raw) / 1024, 2)

    try:
        db.add(BackupLogModel(
            backup_name=filename,
            backup_size=f"{size_kb} KB",
            tables_included=",".join(selected),
            backup_type=backup_type,
            status="success",
        ))
        db.commit()
    except Exception:
        pass

    return StreamingResponse(
        io.BytesIO(raw),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        backup_data = json.loads(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON file")

    if "tables" not in backup_data:
        raise HTTPException(status_code=400, detail="Invalid backup format — missing 'tables' key")

    tables_data: dict = backup_data["tables"]
    restored = []

    try:
        for table in TRUNCATE_ORDER:
            if table in tables_data:
                try:
                    db.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;'))
                    db.commit()
                except Exception:
                    db.rollback()

        for table in RESTORE_ORDER:
            if table not in tables_data:
                continue
            records = tables_data[table].get("records", [])
            if not records:
                continue
            for i in range(0, len(records), 50):
                chunk = records[i : i + 50]
                for rec in chunk:
                    cols = ", ".join(f'"{c}"' for c in rec)
                    placeholders = ", ".join(f":{c}" for c in rec)
                    try:
                        db.execute(
                            text(f'INSERT INTO "{table}" ({cols}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING'),
                            rec,
                        )
                    except Exception:
                        pass
                db.commit()
            restored.append(table)

        for table in restored:
            try:
                db.execute(text(
                    f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 0) + 1, false);"
                ))
            except Exception:
                pass
        db.commit()

        return {"success": True, "tables_restored": restored}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


@router.post("/reset")
async def reset_all_data(
    confirm: str = Form(...),
    db: Session = Depends(get_db),
):
    """Truncate all tables (full factory reset). Requires confirm='RESET' in body."""
    if confirm != "RESET":
        raise HTTPException(status_code=400, detail="Send confirm=RESET to proceed")

    cleared = []
    for table in TRUNCATE_ORDER:
        try:
            db.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;'))
            db.commit()
            cleared.append(table)
        except Exception:
            db.rollback()

    # Log the reset event
    try:
        db.add(BackupLogModel(
            backup_name="FACTORY RESET",
            backup_size="—",
            tables_included=",".join(cleared),
            backup_type="reset",
            status="success",
        ))
        db.commit()
    except Exception:
        pass

    return {"success": True, "tables_cleared": cleared}


@router.get("/logs")
async def get_logs(db: Session = Depends(get_db)):
    logs = db.query(BackupLogModel).order_by(BackupLogModel.created_at.desc()).limit(100).all()
    return [
        {
            "id": l.id,
            "backup_name": l.backup_name,
            "backup_size": l.backup_size,
            "tables_included": l.tables_included,
            "backup_type": l.backup_type,
            "status": l.status,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]


@router.delete("/logs/{log_id}")
async def delete_log(log_id: int, db: Session = Depends(get_db)):
    log = db.query(BackupLogModel).filter(BackupLogModel.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
    return {"message": "Deleted"}
