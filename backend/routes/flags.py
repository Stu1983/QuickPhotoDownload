from fastapi import APIRouter, HTTPException

from backend.database import get_db
from backend.models import FlagCreate, FlagSummary

VALID_COLOURS = {
    "red", "blue", "green", "yellow", "orange",
    "purple", "pink", "cyan", "lime", "white",
}

router = APIRouter(prefix="/api", tags=["flags"])


@router.post("/photos/{photo_id}/flags")
async def add_flag(photo_id: int, flag: FlagCreate):
    if flag.colour not in VALID_COLOURS:
        raise HTTPException(status_code=400, detail=f"Invalid colour. Must be one of: {', '.join(sorted(VALID_COLOURS))}")

    db = await get_db()
    try:
        # Check photo exists
        rows = await db.execute_fetchall("SELECT id FROM photos WHERE id = ?", (photo_id,))
        if not rows:
            raise HTTPException(status_code=404, detail="Photo not found")

        await db.execute(
            "INSERT OR IGNORE INTO flags (photo_id, colour) VALUES (?, ?)",
            (photo_id, flag.colour),
        )
        await db.commit()
        return {"status": "ok"}
    finally:
        await db.close()


@router.delete("/photos/{photo_id}/flags/{colour}")
async def remove_flag(photo_id: int, colour: str):
    db = await get_db()
    try:
        await db.execute(
            "DELETE FROM flags WHERE photo_id = ? AND colour = ?",
            (photo_id, colour),
        )
        await db.commit()
        return {"status": "ok"}
    finally:
        await db.close()


@router.get("/flags/summary", response_model=list[FlagSummary])
async def flag_summary():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT colour, COUNT(*) as count FROM flags GROUP BY colour ORDER BY count DESC"
        )
        return [FlagSummary(colour=row[0], count=row[1]) for row in rows]
    finally:
        await db.close()
