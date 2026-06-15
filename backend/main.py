from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import pathlib
from auth import router as auth_router
from ConstructionLeads import router as leads_router
from AmcLeads import router as amc_leads_router
from Dashboard import router as dashboard_router
from pool_design import router as pool_design_router
from quotation import router as quotation_router
from attendence import router as attendence_router
from m2a_accouts import router as m2a_accouts_router
from Elite_pool_accounts import router as elite_pool_accounts_router
from Office_expenses import router as office_expenses_router
from FollowUp_Calls import router as followup_calls_router
from Call_track import router as call_track_router
from Review import router as review_router
from construction import router as construction_router
from amc import router as amc_router
from procurement import router as procurement_router
from pipeline import router as pipeline_router
from notifications import router as notifications_router
from users import router as users_router
from Add_leads import router as add_leads_router
from backup import router as backup_router
from invoice_generator import router as invoice_router
from vendor import router as vendor_router
from inventory import router as inventory_router
from staff_profile import router as staff_profile_router
from salary_history import router as salary_history_router


from contextlib import asynccontextmanager
from database import get_db

@asynccontextmanager
async def lifespan(app):
    # Retroactively sync missing expense records for uploaded invoices
    try:
        from Elite_pool_accounts import _sync_invoice_expenses
        db = next(get_db())
        result = _sync_invoice_expenses(db)
        print(f"[startup] invoice-expense sync: {result}")
        db.close()
    except Exception as e:
        print(f"[startup] invoice-expense sync failed: {e}")
    yield

app = FastAPI(title="Elite Pool Builders CRM API", lifespan=lifespan)

import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(leads_router)
app.include_router(amc_leads_router)
app.include_router(dashboard_router)
app.include_router(pool_design_router)
app.include_router(quotation_router)
app.include_router(attendence_router)
app.include_router(m2a_accouts_router)
app.include_router(elite_pool_accounts_router)
app.include_router(office_expenses_router)
app.include_router(followup_calls_router)
app.include_router(call_track_router)
app.include_router(review_router)
app.include_router(construction_router)
app.include_router(add_leads_router)
app.include_router(amc_router)
app.include_router(procurement_router)
app.include_router(pipeline_router)
app.include_router(notifications_router)
app.include_router(users_router)
app.include_router(backup_router)
app.include_router(invoice_router)
app.include_router(vendor_router)
app.include_router(inventory_router)
app.include_router(staff_profile_router)
app.include_router(salary_history_router)


@app.get("/api")
async def root():
    return {"message": "Welcome to Elite Pool Builders CRM API", "docs": "/docs"}

# Serve React frontend static files
static_dir = pathlib.Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")
    app.mount("/public", StaticFiles(directory=static_dir), name="public")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve static files (images, icons etc) if they exist
        file_path = static_dir / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_dir / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
