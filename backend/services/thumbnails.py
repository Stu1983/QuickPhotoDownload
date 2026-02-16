import logging
import os
from PIL import Image, ImageOps

from backend.config import config

logger = logging.getLogger(__name__)


def generate_thumbnail(source_path: str, output_path: str, max_size: int = None) -> bool:
    """Generate a thumbnail respecting EXIF orientation."""
    if max_size is None:
        max_size = config.THUMB_SIZE
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            img.save(output_path, "JPEG", quality=config.THUMB_QUALITY)
        return True
    except Exception as e:
        logger.error("Failed to generate thumbnail for %s: %s", source_path, e)
        return False


def generate_preview(source_path: str, output_path: str, max_size: int = None) -> bool:
    """Generate a preview image respecting EXIF orientation."""
    if max_size is None:
        max_size = config.PREVIEW_SIZE
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            img.save(output_path, "JPEG", quality=config.PREVIEW_QUALITY)
        return True
    except Exception as e:
        logger.error("Failed to generate preview for %s: %s", source_path, e)
        return False


def resize_for_download(source_path: str, output_path: str, max_size: int, quality: int) -> bool:
    """Resize an image for download."""
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with Image.open(source_path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            img.save(output_path, "JPEG", quality=quality)
        return True
    except Exception as e:
        logger.error("Failed to resize %s: %s", source_path, e)
        return False
