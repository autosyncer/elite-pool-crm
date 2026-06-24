"""
Remove duplicate attendance records (keep the one with the lowest id per employee+date)
and add a unique constraint so duplicates can never be inserted again.
Run once: python migrate_attendance_dedup.py
"""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Delete duplicates — keep the earliest record (lowest id) per employee+date
    conn.execute(text("""
        DELETE FROM attendence
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM attendence
            GROUP BY employee_id, date
        )
    """))

    # Add unique constraint to prevent future duplicates
    conn.execute(text("""
        ALTER TABLE attendence
        ADD CONSTRAINT uq_attendence_emp_date UNIQUE (employee_id, date)
    """))

    conn.commit()
    print("Done: duplicates removed and unique constraint added.")
