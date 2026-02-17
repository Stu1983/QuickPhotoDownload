import io
import os
import tempfile
import zipfile
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from backend.config import config
from backend.database import get_db
from backend.models import DownloadRequest
from backend.services.thumbnails import resize_for_download

router = APIRouter(prefix="/api", tags=["download"])

SIZE_PRESETS = {
    "share": (config.SHARE_SIZE, config.SHARE_QUALITY),
    "high": (config.HIGH_SIZE, config.HIGH_QUALITY),
    "original": (None, None),
}


@router.post("/download")
async def download_photos(req: DownloadRequest):
    db = await get_db()
    try:
        if req.size not in SIZE_PRESETS:
            raise HTTPException(status_code=400, detail="Invalid size preset")

        # Build query to get photo files
        conditions = []
        params = []

        if req.photo_ids:
            placeholders = ",".join("?" * len(req.photo_ids))
            conditions.append(f"p.id IN ({placeholders})")
            params.extend(req.photo_ids)
        if req.flag:
            conditions.append("p.id IN (SELECT photo_id FROM flags WHERE colour = ?)")
            params.append(req.flag)
        if req.day:
            conditions.append("p.exif_date_day = ?")
            params.append(req.day)

        if not conditions:
            raise HTTPException(status_code=400, detail="No photos selected")

        where = "WHERE " + " AND ".join(conditions)
        rows = await db.execute_fetchall(
            f"SELECT p.id, p.original_path, p.filename FROM photos p {where}",
            params,
        )

        if not rows:
            raise HTTPException(status_code=404, detail="No photos found")

        max_size, quality = SIZE_PRESETS[req.size]

        # Build zip filename
        parts = ["photos"]
        if req.day:
            parts.append(req.day)
        if req.flag:
            parts.append(f"{req.flag}-flag")
        zip_filename = "-".join(parts) + ".zip"

        # Generate ZIP in memory
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for row in rows:
                photo_id, original_path, filename = row[0], row[1], row[2]
                filepath = os.path.join(config.SORTED_DIR, original_path, filename)

                if not os.path.exists(filepath):
                    continue

                if req.size == "original":
                    zf.write(filepath, filename)
                else:
                    # Resize to temp file
                    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                        tmp_path = tmp.name

                    try:
                        resize_for_download(filepath, tmp_path, max_size, quality)
                        zf.write(tmp_path, filename)
                    finally:
                        if os.path.exists(tmp_path):
                            os.unlink(tmp_path)

        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{zip_filename}"'},
        )
    finally:
        await db.close()
