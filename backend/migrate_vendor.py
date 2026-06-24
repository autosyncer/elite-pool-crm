from database import engine
from sqlalchemy import text

new_vals = ['plumbing', 'civil', 'chemical', 'electrical', 'mechanical', 'water_proofing']

with engine.connect() as conn:
    for v in new_vals:
        try:
            sql = "ALTER TYPE vendor_category ADD VALUE IF NOT EXISTS '" + v + "'"
            conn.execute(text(sql))
            conn.commit()
            print('Added: ' + v)
        except Exception as e:
            print('Skip ' + v + ': ' + str(e))
    try:
        conn.execute(text('ALTER TABLE vendors ADD COLUMN IF NOT EXISTS gst_number VARCHAR(20)'))
        conn.commit()
        print('Added gst_number column')
    except Exception as e:
        print('gst_number error: ' + str(e))

print('Migration done')
