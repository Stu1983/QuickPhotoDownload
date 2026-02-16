import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

import aiosqlite

from backend.config import config
from backend.database import get_db
from backend.services.exif import read_exif
from backend.services.file_ops import (
    find_date_folder,
    find_matching_raw,
    is_jpeg,
    safe_move,
    safe_set_timestamps,
    should_ignore,
)
from backend.services.thumbnails import generate_preview, generate_thumbnail

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=4)


async def ingest_file(filepath: str) -> bool:
    """Ingest a single JPEG file from the source directory."""
    filename = os.path.basename(filepath)

    if should_ignore(filename):
        return False
    if not is_jpeg(filename):
        return False
    if not os.path.exists(filepath):
        return False

    loop = asyncio.get_event_loop()
    exif = await loop.run_in_executor(_executor, read_exif, filepath)

    date_prefix = exif.date_folder
    if not date_prefix:
        # Use file modification date as fallback
        mtime = os.path.getmtime(filepath)
        from datetime import datetime
        dt = datetime.fromtimestamp(mtime)
        date_prefix = dt.strftime("%d%m%y")
        exif.date_taken = dt

    # Find or create date folder
    existing_folder = find_date_folder(date_prefix)
    if existing_folder:
        folder_name = existing_folder
    else:
        folder_name = date_prefix

    folder_path = os.path.join(config.SORTED_DIR, folder_name)
    os.makedirs(folder_path, exist_ok=True)

    dest_path = os.path.join(folder_path, filename)

    # Handle duplicate filenames
    if os.path.exists(dest_path) and os.path.abspath(filepath) != os.path.abspath(dest_path):
        stem, ext = os.path.splitext(filename)
        counter = 1
        while os.path.exists(dest_path):
            dest_path = os.path.join(folder_path, f"{stem}_{counter}{ext}")
            counter += 1
        filename = os.path.basename(dest_path)

    # Move JPEG
    if os.path.abspath(filepath) != os.path.abspath(dest_path):
        moved = await loop.run_in_executor(_executor, safe_move, filepath, dest_path)
        if not moved:
            return False

    # Move matching RAW file
    raw_path = await loop.run_in_executor(_executor, find_matching_raw, filepath)
    raw_filename = None
    if raw_path and os.path.exists(raw_path):
        raw_dest = os.path.join(folder_path, os.path.basename(raw_path))
        await loop.run_in_executor(_executor, safe_move, raw_path, raw_dest)
        raw_filename = os.path.basename(raw_path)

    # Fix timestamps
    if exif.date_taken:
        await loop.run_in_executor(_executor, safe_set_timestamps, dest_path, exif.date_taken)

    # Insert into DB and generate thumbnails
    db = await get_db()
    try:
        cursor = await db.execute(
            """INSERT OR IGNORE INTO photos
               (filename, original_path, folder_name, exif_date, exif_date_day,
                width, height, file_size, has_raw_pair, raw_filename)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                filename,
                folder_name,
                folder_name,
                exif.iso_date,
                exif.date_day,
                exif.width,
                exif.height,
                os.path.getsize(dest_path) if os.path.exists(dest_path) else None,
                raw_filename is not None,
                raw_filename,
            ),
        )
        await db.commit()

        photo_id = cursor.lastrowid
        if photo_id and photo_id > 0:
            thumb_path = os.path.join(config.THUMBS_DIR, f"{photo_id}.jpg")
            preview_path = os.path.join(config.PREVIEWS_DIR, f"{photo_id}.jpg")

            await loop.run_in_executor(_executor, generate_thumbnail, dest_path, thumb_path)
            await loop.run_in_executor(_executor, generate_preview, dest_path, preview_path)

            await db.execute(
                "UPDATE photos SET thumbnail_path = ?, preview_path = ? WHERE id = ?",
                (f"{photo_id}.jpg", f"{photo_id}.jpg", photo_id),
            )
            await db.commit()

            # Update folder record
            await _update_folder(db, folder_name, date_prefix)

            logger.info("Ingested %s → %s/%s (id=%d)", filepath, folder_name, filename, photo_id)
            return True
        else:
            # Photo already existed
            logger.debug("Photo already in DB: %s/%s", folder_name, filename)
            return False
    finally:
        await db.close()


async def index_existing_file(filepath: str, folder_name: str) -> bool:
    """Index a file that already exists in the sorted directory."""
    filename = os.path.basename(filepath)
    if should_ignore(filename) or not is_jpeg(filename):
        return False

    loop = asyncio.get_event_loop()
    exif = await loop.run_in_executor(_executor, read_exif, filepath)

    date_prefix = folder_name[:6] if len(folder_name) >= 6 else folder_name

    db = await get_db()
    try:
        # Check if already indexed
        row = await db.execute_fetchall(
            "SELECT id FROM photos WHERE original_path = ? AND filename = ?",
            (folder_name, filename),
        )
        if row:
            return False

        cursor = await db.execute(
            """INSERT OR IGNORE INTO photos
               (filename, original_path, folder_name, exif_date, exif_date_day,
                width, height, file_size, has_raw_pair, raw_filename)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                filename,
                folder_name,
                folder_name,
                exif.iso_date,
                exif.date_day,
                exif.width,
                exif.height,
                os.path.getsize(filepath) if os.path.exists(filepath) else None,
                find_matching_raw(filepath) is not None,
                os.path.basename(find_matching_raw(filepath)) if find_matching_raw(filepath) else None,
            ),
        )
        await db.commit()

        photo_id = cursor.lastrowid
        if photo_id and photo_id > 0:
            thumb_path = os.path.join(config.THUMBS_DIR, f"{photo_id}.jpg")
            preview_path = os.path.join(config.PREVIEWS_DIR, f"{photo_id}.jpg")

            await loop.run_in_executor(_executor, generate_thumbnail, filepath, thumb_path)
            await loop.run_in_executor(_executor, generate_preview, filepath, preview_path)

            await db.execute(
                "UPDATE photos SET thumbnail_path = ?, preview_path = ? WHERE id = ?",
                (f"{photo_id}.jpg", f"{photo_id}.jpg", photo_id),
            )
            await db.commit()

            await _update_folder(db, folder_name, date_prefix)
            logger.info("Indexed existing file: %s/%s (id=%d)", folder_name, filename, photo_id)
            return True
        return False
    finally:
        await db.close()


async def _update_folder(db: aiosqlite.Connection, folder_name: str, date_prefix: str):
    """Update or create folder record with photo count."""
    display_name = None
    if len(folder_name) > 6:
        display_name = folder_name[6:].strip().lstrip("-").strip()

    await db.execute(
        """INSERT INTO folders (folder_name, date_prefix, display_name, photo_count)
           VALUES (?, ?, ?, (SELECT COUNT(*) FROM photos WHERE folder_name = ?))
           ON CONFLICT(folder_name) DO UPDATE SET
           photo_count = (SELECT COUNT(*) FROM photos WHERE folder_name = ?)""",
        (folder_name, date_prefix, display_name, folder_name, folder_name),
    )
    await db.commit()
