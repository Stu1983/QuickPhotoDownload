import logging
import os
import shutil
import time
from datetime import datetime

from backend.config import config

logger = logging.getLogger(__name__)


def safe_move(src: str, dst: str) -> bool:
    """Move a file with retry logic for Syncthing locks."""
    retries = config.FILE_OP_RETRIES
    delay = config.FILE_OP_RETRY_DELAY
    for attempt in range(retries):
        try:
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.move(src, dst)
            return True
        except (PermissionError, OSError) as e:
            if attempt < retries - 1:
                logger.warning("Retry %d/%d moving %s: %s", attempt + 1, retries, src, e)
                time.sleep(delay)
            else:
                logger.error("Failed to move %s after %d attempts: %s", src, retries, e)
                return False
    return False


def safe_set_timestamps(filepath: str, exif_datetime: datetime) -> bool:
    """Set file timestamps with retry logic."""
    ts = exif_datetime.timestamp()
    retries = config.FILE_OP_RETRIES
    delay = config.FILE_OP_RETRY_DELAY
    for attempt in range(retries):
        try:
            os.utime(filepath, (ts, ts))
            return True
        except (PermissionError, OSError) as e:
            if attempt < retries - 1:
                logger.warning("Retry %d/%d setting timestamps on %s: %s", attempt + 1, retries, filepath, e)
                time.sleep(delay)
            else:
                logger.error("Failed to set timestamps on %s: %s", filepath, e)
                return False
    return False


def should_ignore(name: str) -> bool:
    """Check if a file/directory should be ignored."""
    lower = name.lower()
    if lower in config.IGNORE_FILES:
        return True
    if lower in config.IGNORE_DIRS:
        return True
    for prefix in config.IGNORE_PREFIXES:
        if lower.startswith(prefix):
            return True
    return False


def is_jpeg(filename: str) -> bool:
    """Check if a file is a JPEG by extension."""
    _, ext = os.path.splitext(filename)
    return ext.lower() in config.JPEG_EXTENSIONS


def is_raw(filename: str) -> bool:
    """Check if a file is a RAW image by extension."""
    _, ext = os.path.splitext(filename)
    return ext.lower() in config.RAW_EXTENSIONS


def find_matching_raw(jpeg_path: str) -> str | None:
    """Find a matching RAW file for a given JPEG."""
    stem = os.path.splitext(jpeg_path)[0]
    directory = os.path.dirname(jpeg_path)
    for ext in config.RAW_EXTENSIONS:
        for case in [ext.lower(), ext.upper()]:
            raw_path = os.path.join(directory, os.path.basename(stem) + case)
            if os.path.exists(raw_path):
                return raw_path
    return None


def find_date_folder(date_prefix: str, sorted_dir: str = None) -> str | None:
    """Find an existing folder matching a date prefix in the sorted directory."""
    if sorted_dir is None:
        sorted_dir = config.SORTED_DIR
    if not os.path.exists(sorted_dir):
        return None
    for entry in os.listdir(sorted_dir):
        if os.path.isdir(os.path.join(sorted_dir, entry)):
            if entry.startswith(date_prefix):
                return entry
    return None
