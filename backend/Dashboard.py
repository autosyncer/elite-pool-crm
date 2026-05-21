from fastapi import Depends, APIRouter
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String
from database import get_db
from models import (
    ConstructionLeadModel,
    AMCLeadModel,
    QuotationModel,
    FollowupSchedule,
    ConstructionSiteModel,
    AmcSiteModel,
    ProcurementModel,
    LeadStatus,
    QuotationStatus,
    ProcurementStatus,
    ConstructionSiteStatus,
    CallLog,
    AgentDailyStats,
)
from datetime import date


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


# ─────────────────────────────────────────────
#  Legacy full-data endpoint (keep as-is)
# ─────────────────────────────────────────────
@router.get("/view")
async def view_dashboard(db: Session = Depends(get_db)):
    construction_leads = db.query(ConstructionLeadModel).all()
    amc_leads = db.query(AMCLeadModel).all()
    return {
        "construction_leads": construction_leads,
        "amc_leads": amc_leads
    }


# ─────────────────────────────────────────────
#  KPI Summary Endpoint
# ─────────────────────────────────────────────
@router.get("/kpis")
async def get_kpis(db: Session = Depends(get_db)):
    today = date.today()

    # ── Lead Counts ──────────────────────────
    total_construction = db.query(func.count(ConstructionLeadModel.id)).scalar() or 0
    total_amc          = db.query(func.count(AMCLeadModel.id)).scalar() or 0
    total_leads        = total_construction + total_amc

    # New leads this month (construction + amc)
    new_construction_this_month = (
        db.query(func.count(ConstructionLeadModel.id))
        .filter(
            func.extract("month", ConstructionLeadModel.created_at) == today.month,
            func.extract("year",  ConstructionLeadModel.created_at) == today.year,
        )
        .scalar() or 0
    )
    new_amc_this_month = (
        db.query(func.count(AMCLeadModel.id))
        .filter(
            func.extract("month", AMCLeadModel.created_at) == today.month,
            func.extract("year",  AMCLeadModel.created_at) == today.year,
        )
        .scalar() or 0
    )
    new_leads_this_month = new_construction_this_month + new_amc_this_month

    # ── Lead Status Breakdown ─────────────────
    from models import PoolDesignModel
    c_leads = db.query(ConstructionLeadModel).all()
    a_leads = db.query(AMCLeadModel).all()
    
    active_design_keys = {(d.lead_id, d.lead_type) for d in db.query(PoolDesignModel).filter(PoolDesignModel.status == "in_progress").all()}
    pending_quote_keys = {q.lead_id for q in db.query(QuotationModel).filter(QuotationModel.status == "pending").all()}
    sent_quote_keys = {q.lead_id for q in db.query(QuotationModel).filter(QuotationModel.status == "sent").all()}
    followup_keys = {(f.lead_id, f.lead_type.value) for f in db.query(FollowupSchedule).all()}

    pipeline = {
        "new": 0,
        "design": 0,
        "quoted": 0,
        "followup": 0,
        "closed": 0
    }

    def process_lead(l, lead_type):
        if l.status and l.status.value == "closed":
            pipeline["closed"] += 1
            return

        has_any = False
        if (l.id, lead_type) in active_design_keys:
            pipeline["design"] += 1
            has_any = True
        
        if l.lead_code in pending_quote_keys:
            pipeline["quoted"] += 1
            has_any = True
            
        if (l.id, lead_type) in followup_keys:
            pipeline["followup"] += 1
            has_any = True
            
        if not has_any:
            pipeline["new"] += 1

    for l in c_leads:
        process_lead(l, "construction")
    for l in a_leads:
        process_lead(l, "amc")


    # ── Lead Source Breakdown ─────────────────
    from models import LeadSource
    def count_by_source(model, source: LeadSource):
        # Cast enum column to String to avoid PostgreSQL strict enum type mismatch
        return (
            db.query(func.count(model.id))
            .filter(cast(model.source, String) == source.value)
            .scalar() or 0
        )

    sources = {
        "meta_ad":   count_by_source(ConstructionLeadModel, LeadSource.meta_ad)   + count_by_source(AMCLeadModel, LeadSource.meta_ad),
        "google_ad": count_by_source(ConstructionLeadModel, LeadSource.google_ad) + count_by_source(AMCLeadModel, LeadSource.google_ad),
        "referral":  count_by_source(ConstructionLeadModel, LeadSource.referral)  + count_by_source(AMCLeadModel, LeadSource.referral),
        "walk_in":   count_by_source(ConstructionLeadModel, LeadSource.walk_in)   + count_by_source(AMCLeadModel, LeadSource.walk_in),
        "other":     count_by_source(ConstructionLeadModel, LeadSource.other)     + count_by_source(AMCLeadModel, LeadSource.other),
    }

    # ── Quotations ────────────────────────────
    total_quotes  = db.query(func.count(QuotationModel.id)).scalar() or 0
    quotes_sent   = db.query(func.count(QuotationModel.id)).filter(QuotationModel.status == QuotationStatus.sent).scalar() or 0
    quotes_pending = db.query(func.count(QuotationModel.id)).filter(QuotationModel.status == QuotationStatus.pending).scalar() or 0

    # ── Follow-ups ────────────────────────────
    active_followups = db.query(func.count(FollowupSchedule.id)).scalar() or 0

    # Calls logged today
    calls_today = db.query(func.count(CallLog.id)).filter(CallLog.call_date == today).scalar() or 0

    # ── Active Sites ──────────────────────────
    active_construction_sites = (
        db.query(func.count(ConstructionSiteModel.id))
        .filter(ConstructionSiteModel.status == ConstructionSiteStatus.active)
        .scalar() or 0
    )
    active_amc_sites = (
        db.query(func.count(AmcSiteModel.id))
        .filter(AmcSiteModel.status == "active")
        .scalar() or 0
    )

    # ── Procurement ───────────────────────────
    pending_procurements = (
        db.query(func.count(ProcurementModel.id))
        .filter(ProcurementModel.status == ProcurementStatus.pending)
        .scalar() or 0
    )
    done_procurements = (
        db.query(func.count(ProcurementModel.id))
        .filter(ProcurementModel.status == ProcurementStatus.done)
        .scalar() or 0
    )

    # ── Agent Performance (today) ─────────────
    agent_stats_today = (
        db.query(CallLog.agent_name, func.count(CallLog.id).label("calls_today"))
        .filter(CallLog.call_date == today)
        .group_by(CallLog.agent_name)
        .all()
    )
    agents = [
        {"agent_name": row.agent_name, "calls_today": row.calls_today}
        for row in agent_stats_today
    ]

    # ── Assemble Response ─────────────────────
    return {
        "leads": {
            "total":                  total_leads,
            "total_construction":     total_construction,
            "total_amc":              total_amc,
            "new_this_month":         new_leads_this_month,
        },
        "pipeline": pipeline,
        "sources":  sources,
        "quotations": {
            "total":   total_quotes,
            "sent":    quotes_sent,
            "pending": quotes_pending,
        },
        "followups": {
            "active":      active_followups,
            "calls_today": calls_today,
        },
        "sites": {
            "active_construction": active_construction_sites,
            "active_amc":         active_amc_sites,
        },
        "procurement": {
            "pending": pending_procurements,
            "done":    done_procurements,
        },
        "agents": agents,
    }