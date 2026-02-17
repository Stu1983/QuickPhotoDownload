import asyncio
import logging
import os
from datetime import datetime

from backend.config import config
from backend.database import get_db
from backend.services.file_ops import is_jpeg, should_ignore
from backend.services.ingest import _ensure_thumbnails, index_existing_file, ingest_file

logger = logging.getLogger(__name__)

_last_scan: str | None = None
_scan_lock = asyncio.Lock()


def get_last_scan() -> str | None:
    return _last_scan


async def run_scan():
    """Run a full scan of source and sorted directories."""
    global _last_scan

    async with _scan_lock:
        logger.info("Starting scan...")

        # 1. Process any files left in source
        await _scan_source()

        # 2. Index files in sorted that aren't in DB
        await _scan_sorted()

        # 3. Repair any photos with missing thumbnails
        await _repair_missing_thumbnails()

        # 4. Remove DB entries for files that no longer exist
        await _cleanup_missing()

        # 5. Update folder counts
        await _update_folder_counts()

        _last_scan = datetime.now().isoformat()
        logger.info("Scan complete at %s", _last_scan)


async def _scan_source():
    """Scan source directory for unprocessed files.

    When source and sorted are the same directory, only look at files
    directly in the root (not inside date subdirectories — those are
    already sorted and handled by _scan_sorted).
    """
    source_dir = config.SOURCE_DIR
    if not os.path.exists(source_dir):
        logger.warning("Source directory does not exist: %s", source_dir)
        return

    same_dir = os.path.realpath(source_dir) == os.path.realpath(config.SORTED_DIR)

    if same_dir:
        # Only process loose files at the root level
        for f in os.listdir(source_dir):
            filepath = os.path.join(source_dir, f)
            if os.path.isdir(filepath):
                continue
            if should_ignore(f) or not is_jpeg(f):
                continue
            try:
                await ingest_file(filepath)
            except Exception as e:
                logger.error("Error ingesting %s: %s", filepath, e)
    else:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [d for d in dirs if not should_ignore(d)]
            for f in files:
                if should_ignore(f) or not is_jpeg(f):
                    continue
                filepath = os.path.join(root, f)
                try:
                    await ingest_file(filepath)
                except Exception as e:
                    logger.error("Error ingesting %s: %s", filepath, e)


async def _scan_sorted():
    """Scan sorted directory for files not yet in the database."""
    sorted_dir = config.SORTED_DIR
    if not os.path.exists(sorted_dir):
        logger.warning("Sorted directory does not exist: %s", sorted_dir)
        return

    for folder_entry in os.listdir(sorted_dir):
        folder_path = os.path.join(sorted_dir, folder_entry)
        if not os.path.isdir(folder_path) or should_ignore(folder_entry):
            continue

        for f in os.listdir(folder_path):
            if should_ignore(f) or not is_jpeg(f):
                continue
            filepath = os.path.join(folder_path, f)
            try:
                await index_existing_file(filepath, folder_entry)
            except Exception as e:
                logger.error("Error indexing %s: %s", filepath, e)


async def _repair_missing_thumbnails():
    """Find photos in the DB that are missing thumbnail/preview files and regenerate."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, original_path, filename FROM photos"
        )
        repaired = 0
        for row in rows:
            photo_id, original_path, filename = row[0], row[1], row[2]
            thumb_path = os.path.join(config.THUMBS_DIR, f"{photo_id}.jpg")
            preview_path = os.path.join(config.PREVIEWS_DIR, f"{photo_id}.jpg")

            if os.path.exists(thumb_path) and os.path.exists(preview_path):
                continue

            # Source file on disk
            filepath = os.path.join(config.SORTED_DIR, original_path, filename)
            if not os.path.exists(filepath):
                continue

            if await _ensure_thumbnails(db, photo_id, filepath):
                repaired += 1

        if repaired:
            logger.info("Repaired thumbnails for %d photos", repaired)
    finally:
        await db.close()


async def _cleanup_missing():
    """Remove DB entries for files that no longer exist on disk."""
    db = await get_db()
    try:
        rows = await db.execute_fetchall("SELECT id, original_path, filename, thumbnail_path, preview_path FROM photos")
        removed = 0
        for row in rows:
            filepath = os.path.join(config.SORTED_DIR, row[1], row[2])
            if not os.path.exists(filepath):
                # Remove cached files
                if row[3]:
                    thumb = os.path.join(config.THUMBS_DIR, row[3])
                    if os.path.exists(thumb):
                        os.remove(thumb)
                if row[4]:
                    preview = os.path.join(config.PREVIEWS_DIR, row[4])
                    if os.path.exists(preview):
                        os.remove(preview)

                await db.execute("DELETE FROM photos WHERE id = ?", (row[0],))
                removed += 1

        if removed:
            await db.commit()
            logger.info("Removed %d missing photos from database", removed)
    finally:
        await db.close()


async def _update_folder_counts():
    """Update photo counts for all folders."""
    db = await get_db()
    try:
        await db.execute(
            """UPDATE folders SET photo_count = (
                SELECT COUNT(*) FROM photos WHERE photos.folder_name = folders.folder_name
            )"""
        )
        # Remove empty folders from DB
        await db.execute("DELETE FROM folders WHERE photo_count = 0")
        await db.commit()
    finally:
        await db.close()


async def periodic_scanner():
    """Background task that runs scans periodically."""
    while True:
        try:
            await run_scan()
        except Exception as e:
            logger.error("Periodic scan failed: %s", e)
        await asyncio.sleep(config.SCAN_INTERVAL_MINUTES * 60)
