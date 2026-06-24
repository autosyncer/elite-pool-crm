"""
Run once to add photo_url and aadhar_url columns to staff_profiles table.
Usage: python migrate_staff_docs.py
"""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT"))
    conn.execute(text("ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS aadhar_url TEXT"))
    conn.commit()
    print("Done: photo_url and aadhar_url added to staff_profiles.")
