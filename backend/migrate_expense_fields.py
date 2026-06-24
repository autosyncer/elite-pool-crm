from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE ep_expenditures ADD COLUMN IF NOT EXISTS pay_mode pay_mode_enum"))
    conn.execute(text("ALTER TABLE ep_expenditures ADD COLUMN IF NOT EXISTS paid_to VARCHAR(255)"))
    conn.execute(text("ALTER TABLE ep_expenditures ADD COLUMN IF NOT EXISTS purchased_from VARCHAR(255)"))
    conn.commit()
    print("Done: pay_mode, paid_to, purchased_from added to ep_expenditures")
