"""
Run this once to add 'other' to the construction_plan_type enum in the database.
Usage: python migrate_plan_type.py
"""
from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TYPE construction_plan_type ADD VALUE IF NOT EXISTS 'other'"))
    conn.commit()
    print("Done: 'other' added to construction_plan_type enum.")
