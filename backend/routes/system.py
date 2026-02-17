import os
from datetime import datetime
from fastapi import APIRouter

from backend.config import config
from backend.database import get_db
from backend.models import DayOut, StatusOut
from backend.services.scanner import get_last_scan, run_scan

router = APIRouter(prefix="/api", tags=["system"])


@router.post("/scan")
async def trigger_scan():
    await run_scan()
    return {"status": "ok", "last_scan": get_last_scan()}


@router.get("/status", response_model=StatusOut)
async def get_status():
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT COUNT(*) FROM photos")
        total = rows[0][0] if rows else 0

        # Count files in source that haven't been ingested
        pending = 0
        source_dir = config.SOURCE_DIR
        if os.path.exists(source_dir):
            for root, dirs, files in os.walk(source_dir):
                for f in files:
                    ext = os.path.splitext(f)[1].lower()
                    if ext in config.JPEG_EXTENSIONS:
                        pending += 1

        return StatusOut(
            total_photos=total,
            pending_ingest=pending,
            last_scan=get_last_scan(),
        )
    finally:
        await db.close()


@router.get("/days", response_model=list[DayOut])
async def list_days():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """SELECT exif_date_day, COUNT(*) as count
               FROM photos
               WHERE exif_date_day IS NOT NULL
               GROUP BY exif_date_day
               ORDER BY exif_date_day DESC"""
        )
        days = []
        for row in rows:
            date_str = row[0]
            count = row[1]
            try:
                dt = datetime.strptime(date_str, "%Y-%m-%d")
                label = dt.strftime("%a %d %b %Y")
            except ValueError:
                label = date_str

            days.append(DayOut(date=date_str, label=label, count=count))
        return days
    finally:
        await db.close()
