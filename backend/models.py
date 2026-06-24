import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, Time, Text, Enum as SAEnum, ForeignKey, Numeric
import enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database import Base



class UserRoleEnum(str, enum.Enum):
    ceo              = "ceo"
    partner          = "partner"
    admin            = "admin"
    customer_support = "customer_support"

class LeadStatus(str, enum.Enum):
    new      = "new"
    design   = "design"
    quoted   = "quoted"
    followup = "followup"
    closed   = "closed"


class LeadSource(str, enum.Enum):
    meta_ad   = "meta_ad"
    google_ad = "google_ad"
    referral  = "referral"
    walk_in   = "walk_in"
    other     = "other"

class NotificationType(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"
    system = "system"

class NotificationStatus(str, enum.Enum):
    unread = "unread"
    viewed = "viewed"
    done   = "done"

class UserModel(Base):
    __tablename__ = "users"
    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50),  unique=True, nullable=False, index=True)
    full_name       = Column(String(100), nullable=True)
    email           = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String,      nullable=False)
    disabled        = Column(Boolean,     default=False)
    role            = Column(SAEnum(UserRoleEnum, name="user_role", create_type=False),
                             default=UserRoleEnum.customer_support)
    created_at      = Column(DateTime, server_default=func.now())
    last_login      = Column(DateTime, nullable=True)

class ConstructionLeadModel(Base):
    __tablename__ = "construction_leads"
    id          = Column(Integer, primary_key=True, index=True)
    lead_code   = Column(String(50),  unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    phone       = Column(String(20),  nullable=False)
    location    = Column(String(255), nullable=True)
    requirement = Column(String,      nullable=True)
    status      = Column(SAEnum(LeadStatus, name="lead_status", create_type=False),
                         default=LeadStatus.new)
    source      = Column(SAEnum(LeadSource, name="lead_source", create_type=False),
                         default=LeadSource.meta_ad)
    priority    = Column(String(50),  nullable=True, default="Normal")
    created_at  = Column(DateTime, server_default=func.now())

class AMCLeadModel(Base):
    __tablename__ = "amc_leads"
    id          = Column(Integer, primary_key=True, index=True)
    lead_code   = Column(String(50),  unique=True, nullable=False, index=True)
    name        = Column(String(100), nullable=False)
    phone       = Column(String(20),  nullable=False)
    location    = Column(String(255), nullable=True)
    requirement = Column(Text,        nullable=True)
    status      = Column(SAEnum(LeadStatus, name="lead_status", create_type=False),
                         default=LeadStatus.new)
    source      = Column(SAEnum(LeadSource, name="lead_source", create_type=False),
                         default=LeadSource.meta_ad)
    priority    = Column(String(50),  nullable=True, default="Normal")
    created_at  = Column(DateTime, server_default=func.now())

class DesignStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed   = "completed"

class PoolStyle(str, enum.Enum):
    rectangular = "rectangular"
    kidney = "kidney"
    l_shaped = "l_shaped"
    plunge = "plunge"
    freeform = "freeform"
    infinity_edge = "infinity_edge"
    beach_style = "beach_style"
    pipeless = "pipeless"

class PoolDesignModel(Base):
    __tablename__ = "pool_designs"
    id                = Column(Integer, primary_key=True, index=True)
    lead_id           = Column(Integer, nullable=False)
    lead_type         = Column(String(20), nullable=True) # 'construction' or 'amc'
    pool_style        = Column(SAEnum(PoolStyle, name="pool_style", create_type=False), default=PoolStyle.rectangular)
    assigned_designer = Column(String(100), nullable=False)
    design_notes = Column(Text, nullable=True)
    status = Column(SAEnum(DesignStatus, name="design_status", create_type=False),default=DesignStatus.in_progress)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())   

class PoolDesignFileModel(Base):
    __tablename__ = "design_files"
    id          = Column(Integer, primary_key=True, index=True)
    design_id   = Column(Integer, ForeignKey('pool_designs.id', ondelete='CASCADE'), nullable=False)
    file_url    = Column(Text,         nullable=False)
    public_id   = Column(String(255),  nullable=True)
    file_name   = Column(String(255),  nullable=False)
    file_type   = Column(String(10),   nullable=False)
    version     = Column(Integer,      default=1)
    uploaded_by = Column(Integer, ForeignKey('users.id'), nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

class QuotationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"

class QuotationModel(Base):
    __tablename__ = "quotations"
    id          = Column(Integer, primary_key=True, index=True)
    lead_id     = Column(String(50), ForeignKey('construction_leads.lead_code', ondelete='CASCADE'), nullable=False)
    pool_lenght = Column(Integer, nullable=True)
    pool_width  = Column(Integer, nullable=True)
    status      = Column(SAEnum(QuotationStatus, name="quotation_status", create_type=False),default=QuotationStatus.pending)
    pdf_url     = Column(String(255), nullable=True)
    public_id   = Column(String(255), nullable=True)
    created_at  = Column(DateTime, server_default=func.now())
    updated_at  = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AttendenceType(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    half_day = "half_day"
    leave = "leave"     

class AttendenceModel(Base):
    __tablename__ = "attendence"
    id           = Column(Integer, primary_key=True, index=True)
    employee_id  = Column(Integer, ForeignKey('users.id'), nullable=False)
    date         = Column(Date, nullable=False)
    status       = Column(SAEnum(AttendenceType, name="attendence_type", create_type=False), default=AttendenceType.present)
    check_in     = Column(Time, nullable=False)
    check_out    = Column(Time, nullable=True)
    notes        = Column(Text, nullable=True)
    create_at    = Column(DateTime, server_default=func.now())

class m2aAccounts(Base):
    __tablename__ = "m2a_accounts"
    id          = Column(Integer, primary_key=True, index=True)
    site_name   = Column(String(255), unique=True, nullable=False)
    location    = Column(String(255), nullable=False)
    note        = Column(Text, nullable=True)
    last_updated= Column(DateTime, server_default=func.now())
    created_at  = Column(DateTime, server_default=func.now())

class m2a_payments(Base):
    __tablename__ = "m2a_payments"
    id          = Column(Integer, primary_key=True, index=True)
    account_id  = Column(Integer, ForeignKey('m2a_accounts.id'), nullable=False)
    amount      = Column(Numeric(15,2), nullable=False)
    payment_date= Column(Date, nullable=False)

class m2aExpenseType(str, enum.Enum):
    material = "material"
    labour = "labour"
    transport = "transport"
    equipment = "equipment"
    miscellaneous = "miscellaneous"

class m2a_expenses(Base):
    __tablename__ = "m2a_expenditures"
    id          = Column(Integer, primary_key=True, index=True)
    account_id  = Column(Integer, ForeignKey('m2a_accounts.id'), nullable=False)
    amount      = Column(Numeric(15,2), nullable=False)
    expense_date= Column(Date, nullable=False)
    expense_type= Column(SAEnum(m2aExpenseType, name="m2a_expense_type"), nullable=False)
    description = Column(String(255), nullable=True)

class ElitePoolExpenseType(str, enum.Enum):
    materials = "materials"
    labour = "labour"
    transport = "transport"
    equipment = "equipment"
    miscellaneous = "miscellaneous"

class ElitePoolProjectType(str, enum.Enum):
    pool_construction = "pool_construction"
    pool_amc          = "pool_amc"

class ElitePoolAccounts(Base):
    __tablename__ = "ep_accounts"
    id          = Column(Integer, primary_key=True, index=True)
    site_name   = Column(String(255), unique=True, nullable=False)
    location    = Column(String(255), nullable=False)
    project_type= Column(SAEnum(ElitePoolProjectType, name="elite_pool_project_type"), nullable=False)
    note        = Column(Text, nullable=True)
    last_update = Column(DateTime, server_default=func.now())
    created_at  = Column(DateTime, server_default=func.now())

class PayMode(str, enum.Enum):
    cash        = "cash"
    upi         = "upi"
    net_banking = "net_banking"

class ElitePoolPayments(Base):
    __tablename__ = "ep_payments"
    id          = Column(Integer, primary_key=True, index=True)
    account_id  = Column(Integer, ForeignKey('ep_accounts.id'), nullable=False)
    amount      = Column(Numeric(15,2), nullable=False)
    payment_date= Column(Date, nullable=False)
    pay_mode    = Column(SAEnum(PayMode, name="pay_mode_enum"), nullable=True)

class ElitePoolExpenses(Base):
    __tablename__ = "ep_expenditures"
    id              = Column(Integer, primary_key=True, index=True)
    account_id      = Column(Integer, ForeignKey('ep_accounts.id'), nullable=False)
    amount          = Column(Numeric(15,2), nullable=False)
    payment_date    = Column(Date, nullable=False)
    expenses_type   = Column(SAEnum(ElitePoolExpenseType, name="ep_expense_type"), nullable=False)
    description     = Column(String(255), nullable=True)
    note            = Column(Text, nullable=True)
    pay_mode        = Column(SAEnum(PayMode, name="pay_mode_enum"), nullable=True)
    paid_to         = Column(String(255), nullable=True)
    purchased_from  = Column(String(255), nullable=True)


class OfficeExpenseCategory(str, enum.Enum):
    Staffing_Salaries = "Staffing Salaries"
    Office_Rent_Utilities = "Office Rent / Utilities"
    Petty_Office_Expenses = "Petty Office Expenses"

class OfficeExpenseModel(Base):
    __tablename__ = "office_expenses"

    id           = Column(Integer, primary_key=True, index=True)
    category     = Column(SAEnum(OfficeExpenseCategory, name="expenses_category", values_callable=lambda x: [e.value for e in x]), nullable=False)
    payee_name   = Column(String(255), nullable=False) 
    description  = Column(Text, nullable=False)
    amount       = Column(Numeric(15,2), nullable=False)
    expense_date = Column(Date, nullable=False, server_default=func.current_date())
    note         = Column(Text, nullable=True)
    created_at   = Column(Date, server_default=func.now()) # DB says date not datetime


class FollowupLeadType(str, enum.Enum):
    construction = "construction"
    amc = "amc"


class FollowupOutcome(str, enum.Enum):
    Interested = "Interested"
    Very_Interested = "Very Interested"
    Not_Interested = "Not Interested"
    Callback_Requested = "Callback Requested"
    Needs_Time = "Needs Time"
    Follow_up_again = "Follow up again"
    Converted = "Converted!"
    No_Answer = "No Answer"

class CallDuration(str, enum.Enum):
    Less_than_1_min = "< 1 min"
    Less_than_3_min = "1-3 min"
    Less_than_5_min = "3-5 min"
    Less_than_10_min = "5-10 min"
    More_than_10_min = ">10 min"
    

class FollowupSchedule(Base):
    __tablename__ = "followup_schedule"
    id              = Column(Integer, primary_key=True, index=True)
    lead_id         = Column(Integer, nullable=False)
    client_name     = Column(String(255), nullable=False)
    phone           = Column(String(20), nullable=True)
    lead_type       = Column(SAEnum(FollowupLeadType, name="followup_lead_type"), nullable=False)
    rating          = Column(Integer, default=3)
    created_at      = Column(DateTime, server_default=func.now())

class CallLog(Base):
    __tablename__ = "followup_calls"
    id              = Column(Integer, primary_key=True, index=True)
    schedule_id     = Column(Integer, ForeignKey('followup_schedule.id', ondelete='CASCADE'), nullable=False)
    call_number     = Column(Integer, nullable=False)
    outcome         = Column(SAEnum(FollowupOutcome, name="followup_outcome", values_callable=lambda x: [e.value for e in x]), nullable=True)
    duration        = Column(SAEnum(CallDuration, name="call_duration", values_callable=lambda x: [e.value for e in x]), nullable=True)
    agent_name      = Column(String(255))
    call_date       = Column(Date, server_default=func.current_date())
    call_time       = Column(Time, server_default=func.current_time())
    recording_url   = Column(String(512), nullable=True)

class AgentDailyStats(Base):
    __tablename__ = "agent_daily_stats"
    agent_name  = Column(String(255), primary_key=True)
    call_date   = Column(Date, primary_key=True)
    calls_today = Column(Integer)

class ClientReview(Base):
    __tablename__ = "client_reviews"
    id          = Column(Integer, primary_key=True, index=True)
    lead_id     = Column(Integer, nullable=False)
    lead_type   = Column(SAEnum(FollowupLeadType, name="followup_lead_type"), nullable=False)
    rating      = Column(Integer, nullable=False)
    feedback_note = Column(String(255),nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ConstructionSiteStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    on_hold = "on_hold"
    closed = "closed"

class ConstructionSiteModel(Base):
    __tablename__ = "construction_sites"
    id          = Column(Integer, primary_key=True, index=True)
    site_code   = Column(String(50),  unique=True, nullable=False, index=True)
    lead_id     = Column(Integer, ForeignKey('construction_leads.id', ondelete='CASCADE'), nullable=False)
    start_date  = Column(Date, server_default=func.now())
    status      = Column(SAEnum(ConstructionSiteStatus, name="construction_site_status"), default=ConstructionSiteStatus.active)
    created_at  = Column(DateTime, server_default=func.now())


class ConstructionPlanType(str, enum.Enum):
    schematic = 'schematic'
    plumbing  = 'plumbing'
    electrical= 'electrical'
    sectional = 'sectional'
    pumpRoom  = 'pumpRoom'
    cad       = 'cad'
    other     = 'other'

class ConstructionPlan(Base):
    __tablename__ = "construction_plans"

    id          = Column(Integer, primary_key=True, index=True)
    site_id     = Column(Integer, ForeignKey('construction_sites.id', ondelete='CASCADE'), nullable=False)
    plan_type   = Column(SAEnum(ConstructionPlanType, name="construction_plan_type"), nullable=False)
    file_name   = Column(String(255), nullable=False)
    file_url    = Column(Text,         nullable=False)
    public_id   = Column(String(255),  nullable=True)
    updated_at = Column(DateTime, server_default=func.now())


class  ConstructionLogs(Base):
    __tablename__ = "construction_logs"

    id              = Column(Integer, primary_key=True, index=True)
    site_id         = Column(Integer, ForeignKey('construction_sites.id', ondelete='CASCADE'), nullable=False)
    log_date        = Column(Date, server_default=func.now())
    labor_strenght  = Column(String(100), nullable=False)
    work_report     = Column(Text, nullable=False)
    materials_req   = Column(Text, nullable=False)

    procurement_req = Column(Text, nullable=True)

    created_at      = Column(DateTime, server_default=func.now())

    # Relationship to photos
    photos = relationship("ConstructionLogPhotos", back_populates="log")


class ConstructionLogPhotos(Base):
    __tablename__ = "construction_log_photos"

    id          = Column(Integer, primary_key=True, index=True)
    log_id      = Column(Integer, ForeignKey('construction_logs.id', ondelete='CASCADE'), nullable=False)
    photo_url   = Column(String(255), nullable=False)
    photo_name  = Column(String(255), nullable=True)
    public_id   = Column(String(255), nullable=True)

    # Relationship back to log
    log = relationship("ConstructionLogs", back_populates="photos")


# --- AMC MODULE MODELS ---

class AmcSiteModel(Base):
    __tablename__ = "amc_sites"
    id          = Column(Integer, primary_key=True, index=True)
    site_code   = Column(String(50),  unique=True, nullable=False, index=True)
    lead_id     = Column(Integer, ForeignKey('amc_leads.id', ondelete='CASCADE'), nullable=False)
    start_date  = Column(Date, server_default=func.now())
    status      = Column(String(20),  default="active")
    created_at  = Column(DateTime, server_default=func.now())

    # Relationship to visits
    visits = relationship("AmcVisitModel", back_populates="site")

class AmcVisitModel(Base):
    __tablename__ = "amc_visits"
    id               = Column(Integer, primary_key=True, index=True)
    site_id          = Column(Integer, ForeignKey('amc_sites.id', ondelete='CASCADE'), nullable=False)
    visit_date       = Column(Date, server_default=func.now())
    ph_level         = Column(String(10), nullable=True)
    cl_level         = Column(String(10), nullable=True)
    service_report   = Column(Text, nullable=False)
    materials_used   = Column(Text, nullable=True)
    procurement_req  = Column(Text, nullable=True)
    created_at       = Column(DateTime, server_default=func.now())

    # Relationships
    site = relationship("AmcSiteModel", back_populates="visits")
    photos = relationship("AmcVisitPhotoModel", back_populates="visit")

class AmcVisitPhotoModel(Base):
    __tablename__ = "amc_visit_photos"
    id          = Column(Integer, primary_key=True, index=True)
    visit_id    = Column(Integer, ForeignKey('amc_visits.id', ondelete='CASCADE'), nullable=False)
    photo_url   = Column(Text, nullable=False)
    photo_name  = Column(String(255), nullable=True)
    public_id   = Column(String(255), nullable=True)

    # Relationship back to visit
    visit = relationship("AmcVisitModel", back_populates="photos")


# --- PROCUREMENT MODULE MODELS ---

class ProcurementStatus(str, enum.Enum):
    pending = "pending"
    done = "done"

class ProcurementModel(Base):
    __tablename__ = "procurements"
    id               = Column(Integer, primary_key=True, index=True)
    procurement_code = Column(String(50),  unique=True, nullable=False, index=True)
    client_name      = Column(String(100), nullable=False)
    site_name        = Column(String(255), nullable=False)
    site_type        = Column(SAEnum(FollowupLeadType, name="procurement_site_type"), nullable=False)
    requirements     = Column(Text,        nullable=False)
    status           = Column(SAEnum(ProcurementStatus, name="procurement_status"), default=ProcurementStatus.pending)
    logged_at        = Column(Date,        server_default=func.now())
    source_id        = Column(Integer,     nullable=True)
    created_at       = Column(DateTime,    server_default=func.now())


# --- SALARY HISTORY MODEL ---

class SalaryHistoryModel(Base):
    __tablename__ = "salary_history"
    id           = Column(Integer, primary_key=True, index=True)
    employee_name = Column(String(150), nullable=False)
    employee_id  = Column(String(20),  nullable=True)
    designation  = Column(String(100), nullable=True)
    month        = Column(String(20),  nullable=False)
    year         = Column(String(10),  nullable=False)
    gross_wages  = Column(Numeric(12, 2), default=0)
    paid_days    = Column(Integer,     default=0)
    total_days   = Column(Integer,     default=31)
    lop_days     = Column(Integer,     default=0)
    basic        = Column(Numeric(12, 2), default=0)
    hra          = Column(Numeric(12, 2), default=0)
    conveyance   = Column(Numeric(12, 2), default=0)
    medical      = Column(Numeric(12, 2), default=0)
    other        = Column(Numeric(12, 2), default=0)
    total_earnings = Column(Numeric(12, 2), default=0)
    salary_advance = Column(Numeric(12, 2), default=0)
    balance_deduction = Column(Numeric(12, 2), default=0)
    professional_tax  = Column(Numeric(12, 2), default=0)
    total_deductions  = Column(Numeric(12, 2), default=0)
    net_salary   = Column(Numeric(12, 2), default=0)
    note         = Column(Text,        nullable=True)
    created_at   = Column(DateTime,    server_default=func.now())


# --- STAFF PROFILE MODEL ---

class StaffProfileModel(Base):
    __tablename__ = "staff_profiles"
    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(150), nullable=False)
    employee_id  = Column(String(20),  nullable=True)
    designation  = Column(String(100), nullable=True)
    account_no   = Column(String(50),  nullable=True)
    bank_name    = Column(String(100), nullable=True)
    doj          = Column(String(20),  nullable=True)
    phone        = Column(String(20),  nullable=True)
    photo_url    = Column(Text,        nullable=True)
    aadhar_url   = Column(Text,        nullable=True)
    created_at   = Column(DateTime,    server_default=func.now())
    updated_at   = Column(DateTime,    server_default=func.now(), onupdate=func.now())


# --- VENDOR & INVENTORY MODULE MODELS ---

class VendorCategoryEnum(str, enum.Enum):
    materials     = "materials"
    equipment     = "equipment"
    labour        = "labour"
    transport     = "transport"
    plumbing      = "plumbing"
    civil         = "civil"
    chemical      = "chemical"
    electrical    = "electrical"
    mechanical    = "mechanical"
    water_proofing = "water_proofing"
    other         = "other"

class VendorModel(Base):
    __tablename__ = "vendors"
    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(150), nullable=False)
    category       = Column(SAEnum(VendorCategoryEnum, name="vendor_category", create_type=False), nullable=False)
    gst_number     = Column(String(20),  nullable=True)
    contact_person = Column(String(100), nullable=True)
    phone          = Column(String(20),  nullable=True)
    email          = Column(String(150), nullable=True)
    address        = Column(Text,        nullable=True)
    rating         = Column(Integer,     default=0)
    notes          = Column(Text,        nullable=True)
    created_at     = Column(DateTime,    server_default=func.now())

    inventory_items = relationship("InventoryModel", back_populates="vendor")


class InventoryModel(Base):
    __tablename__ = "inventory"
    id           = Column(Integer, primary_key=True, index=True)
    item_name    = Column(String(150), nullable=False)
    category     = Column(String(100), nullable=True)
    quantity     = Column(Numeric(10, 2), default=0)
    unit         = Column(String(30),  nullable=True)
    min_quantity = Column(Numeric(10, 2), default=0)
    vendor_id    = Column(Integer, ForeignKey('vendors.id', ondelete='SET NULL'), nullable=True)
    notes        = Column(Text,    nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())

    vendor = relationship("VendorModel", back_populates="inventory_items")


# --- EP INVOICE MODEL ---

class EPInvoiceModel(Base):
    __tablename__ = "ep_invoices"
    id             = Column(Integer, primary_key=True, index=True)
    account_id     = Column(Integer, ForeignKey('ep_accounts.id', ondelete='CASCADE'), nullable=False)
    invoice_number = Column(String(100), nullable=True)
    file_url       = Column(Text,        nullable=False)
    public_id      = Column(String(255), nullable=True)
    amount         = Column(Numeric(12, 2), nullable=True)
    invoice_date   = Column(Date,        server_default=func.now())
    description    = Column(Text,        nullable=True)
    created_at     = Column(DateTime,    server_default=func.now())

    account = relationship("ElitePoolAccounts")


# --- INVOICE MODEL ---

class InvoiceModel(Base):
    __tablename__ = "invoices"
    id               = Column(Integer,     primary_key=True, index=True)
    invoice_no       = Column(String(100), nullable=False, unique=True, index=True)
    invoice_date     = Column(Date,        server_default=func.now())
    due_date         = Column(String(50),  nullable=True)
    gr_no            = Column(String(100), nullable=True)
    order_no         = Column(String(100), nullable=True)
    project          = Column(String(255), nullable=True)
    state            = Column(String(100), nullable=True, default="Telangana")
    state_code       = Column(String(10),  nullable=True, default="36")
    bill_to_name     = Column(String(255), nullable=False)
    bill_to_address  = Column(Text,        nullable=True)
    bill_to_gstin    = Column(String(20),  nullable=True)
    ship_to_name     = Column(String(255), nullable=True)
    ship_to_address  = Column(Text,        nullable=True)
    ship_to_gstin    = Column(String(20),  nullable=True)
    items_json       = Column(Text,        nullable=False)   # JSON array of line items
    gst_rate         = Column(Numeric(5,2),default=9)        # per slab e.g. 9 for 9%+9%
    sub_total        = Column(Numeric(12,2),default=0)
    cgst             = Column(Numeric(12,2),default=0)
    sgst             = Column(Numeric(12,2),default=0)
    igst             = Column(Numeric(12,2),default=0)
    round_off        = Column(Numeric(6,2), default=0)
    total            = Column(Numeric(12,2),default=0)
    notes            = Column(Text,         nullable=True)
    created_by       = Column(String(150),  nullable=True)
    billed_by        = Column(String(50),   nullable=True)   # 'CEO' or 'Admin'
    created_at       = Column(DateTime,     server_default=func.now())


# --- BACKUP LOG MODEL ---

class BackupLogModel(Base):
    __tablename__ = "backup_logs"
    id               = Column(Integer,     primary_key=True, index=True)
    backup_name      = Column(String(255), nullable=False)
    backup_size      = Column(String(50),  nullable=True)
    tables_included  = Column(Text,        nullable=True)
    backup_type      = Column(String(20),  default="manual")   # manual | auto
    status           = Column(String(20),  default="success")  # success | failed
    created_at       = Column(DateTime,    server_default=func.now())


class NotificationType(str, enum.Enum):
    create = "create"
    update = "update"
    delete = "delete"
    system = "system"


class NotificationStatus(str, enum.Enum):
    unread = "unread"
    viewed = "viewed"
    done   = "done"


class NotificationModel(Base):
    __tablename__ = "notifications"
    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    type        = Column(SAEnum(NotificationType, name="notification_type"), nullable=False)
    module      = Column(String(50), nullable=False)   # Lead Management, Design, etc.
    action      = Column(String(100), nullable=False)  # Lead Added, Design Created, etc.
    message     = Column(String(255), nullable=False)
    entity_id   = Column(String(50), nullable=True)    # L001, Q001, D001
    actor_name  = Column(String(100), nullable=True)   # Venkat, Rajesh, etc.
    status      = Column(SAEnum(NotificationStatus, name="notification_status"), default=NotificationStatus.unread)
    created_at  = Column(DateTime, server_default=func.now())

    user = relationship("UserModel")
