from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pay_mode_enum') THEN
                CREATE TYPE pay_mode_enum AS ENUM ('cash', 'upi', 'net_banking');
            END IF;
        END $$;
    """))
    conn.execute(text("ALTER TABLE ep_payments ADD COLUMN IF NOT EXISTS pay_mode pay_mode_enum"))
    conn.commit()
    print("Done: pay_mode column added to ep_payments")
