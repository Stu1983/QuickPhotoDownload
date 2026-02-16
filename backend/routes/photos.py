import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from backend.config import config
from backend.database import get_db
from backend.models import PhotoOut

router = APIRouter(prefix="/api/photos", tags=["photos"])


@router.get("", response_model=list[PhotoOut])
async def list_photos(
    day: str | None = None,
    flag: str | None = None,
    folder: str | None = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
):
    db = await get_db()
    try:
        conditions = []
        params = []

        if day:
            conditions.append("p.exif_date_day = ?")
            params.append(day)
        if folder:
            conditions.append("p.folder_name LIKE ?")
            params.append(f"{folder}%")
        if flag:
            conditions.append("p.id IN (SELECT photo_id FROM flags WHERE colour = ?)")
            params.append(flag)

        where = ""
        if conditions:
            where = "WHERE " + " AND ".join(conditions)

        offset = (page - 1) * per_page
        params.extend([per_page, offset])

        rows = await db.execute_fetchall(
            f"""SELECT p.id, p.filename, p.original_path, p.folder_name,
                       p.exif_date, p.exif_date_day, p.width, p.height,
                       p.file_size, p.has_raw_pair, p.raw_filename,
                       p.thumbnail_path, p.preview_path
                FROM photos p
                {where}
                ORDER BY p.exif_date DESC, p.filename ASC
                LIMIT ? OFFSET ?""",
            params,
        )

        photos = []
        for row in rows:
            photo_id = row[0]
            # Fetch flags for this photo
            flag_rows = await db.execute_fetchall(
                "SELECT colour FROM flags WHERE photo_id = ?", (photo_id,)
            )
            flags = [f[0] for f in flag_rows]

            photos.append(
                PhotoOut(
                    id=photo_id,
                    filename=row[1],
                    original_path=row[2],
                    folder_name=row[3],
                    exif_date=row[4],
                    exif_date_day=row[5],
                    width=row[6],
                    height=row[7],
                    file_size=row[8],
                    has_raw_pair=bool(row[9]),
                    raw_filename=row[10],
                    thumbnail_url=f"/api/photos/{photo_id}/thumbnail" if row[11] else None,
                    preview_url=f"/api/photos/{photo_id}/preview" if row[12] else None,
                    flags=flags,
                )
            )
        return photos
    finally:
        await db.close()


@router.get("/{photo_id}", response_model=PhotoOut)
async def get_photo(photo_id: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            """SELECT id, filename, original_path, folder_name,
                      exif_date, exif_date_day, width, height,
                      file_size, has_raw_pair, raw_filename,
                      thumbnail_path, preview_path
               FROM photos WHERE id = ?""",
            (photo_id,),
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Photo not found")

        row = rows[0]
        flag_rows = await db.execute_fetchall(
            "SELECT colour FROM flags WHERE photo_id = ?", (photo_id,)
        )
        flags = [f[0] for f in flag_rows]

        return PhotoOut(
            id=row[0],
            filename=row[1],
            original_path=row[2],
            folder_name=row[3],
            exif_date=row[4],
            exif_date_day=row[5],
            width=row[6],
            height=row[7],
            file_size=row[8],
            has_raw_pair=bool(row[9]),
            raw_filename=row[10],
            thumbnail_url=f"/api/photos/{row[0]}/thumbnail" if row[11] else None,
            preview_url=f"/api/photos/{row[0]}/preview" if row[12] else None,
            flags=flags,
        )
    finally:
        await db.close()


@router.get("/{photo_id}/thumbnail")
async def get_thumbnail(photo_id: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT thumbnail_path FROM photos WHERE id = ?", (photo_id,)
        )
        if not rows or not rows[0][0]:
            raise HTTPException(status_code=404, detail="Thumbnail not found")

        thumb_path = os.path.join(config.THUMBS_DIR, rows[0][0])
        if not os.path.exists(thumb_path):
            raise HTTPException(status_code=404, detail="Thumbnail file missing")

        return FileResponse(
            thumb_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "max-age=86400"},
        )
    finally:
        await db.close()


@router.get("/{photo_id}/preview")
async def get_preview(photo_id: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT preview_path FROM photos WHERE id = ?", (photo_id,)
        )
        if not rows or not rows[0][0]:
            raise HTTPException(status_code=404, detail="Preview not found")

        preview_path = os.path.join(config.PREVIEWS_DIR, rows[0][0])
        if not os.path.exists(preview_path):
            raise HTTPException(status_code=404, detail="Preview file missing")

        return FileResponse(
            preview_path,
            media_type="image/jpeg",
            headers={"Cache-Control": "max-age=86400"},
        )
    finally:
        await db.close()


@router.get("/{photo_id}/original")
async def get_original(photo_id: int):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT original_path, filename FROM photos WHERE id = ?", (photo_id,)
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Photo not found")

        filepath = os.path.join(config.SORTED_DIR, rows[0][0], rows[0][1])
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="Original file missing")

        return FileResponse(
            filepath,
            media_type="image/jpeg",
            filename=rows[0][1],
        )
    finally:
        await db.close()
