import logging
import os

from PIL import Image, ImageDraw, ImageFont, ImageOps
from PIL.ExifTags import IFD

from backend.config import config

logger = logging.getLogger(__name__)

# EXIF sub-IFD tag for DateTimeOriginal
_TAG_DATE_ORIGINAL = 0x9003


def _read_date_stamp(img: Image.Image) -> str | None:
    """Extract DateTimeOriginal from the EXIF sub-IFD for overlay text."""
    try:
        exif = img.getexif()
        if not exif:
            return None
        exif_ifd = exif.get_ifd(IFD.Exif)
        date_str = exif_ifd.get(_TAG_DATE_ORIGINAL) if exif_ifd else None
        if date_str:
            # Convert "YYYY:MM:DD HH:MM:SS" → "DD/MM/YYYY HH:MM:SS"
            parts = str(date_str).split(" ", 1)
            if len(parts) == 2:
                ymd = parts[0].replace(":", "/")
                d, m, y = ymd.split("/")[2], ymd.split("/")[1], ymd.split("/")[0]
                return f"{d}/{m}/{y} {parts[1]}"
            return str(date_str)
    except Exception:
        pass
    return None


def _stamp_date(img: Image.Image, date_text: str) -> None:
    """Draw a date/time overlay at the bottom-right of the image."""
    draw = ImageDraw.Draw(img)
    # Scale font size relative to image width (roughly 3% of width, min 12px)
    font_size = max(12, img.width // 30)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), date_text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    padding = max(4, font_size // 4)
    x = img.width - text_w - padding * 2
    y = img.height - text_h - padding * 2

    # Semi-transparent background
    draw.rectangle([x - padding, y - padding, img.width, img.height], fill=(0, 0, 0, 160))
    draw.text((x, y), date_text, fill=(255, 165, 0), font=font)


def generate_thumbnail(source_path: str, output_path: str, max_size: int = None) -> bool:
    """Generate a thumbnail respecting EXIF orientation, with date stamp overlay."""
    if max_size is None:
        max_size = config.THUMB_SIZE
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with Image.open(source_path) as img:
            date_text = _read_date_stamp(img)
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            if date_text:
                img = img.convert("RGBA")
                _stamp_date(img, date_text)
                img = img.convert("RGB")
            img.save(output_path, "JPEG", quality=config.THUMB_QUALITY)
        return True
    except Exception as e:
        logger.error("Failed to generate thumbnail for %s: %s", source_path, e)
        return False


def generate_preview(source_path: str, output_path: str, max_size: int = None) -> bool:
    """Generate a preview image respecting EXIF orientation, with date stamp overlay."""
    if max_size is None:
        max_size = config.PREVIEW_SIZE
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with Image.open(source_path) as img:
            date_text = _read_date_stamp(img)
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_size, max_size), Image.LANCZOS)
            if date_text:
                img = img.convert("RGBA")
                _stamp_date(img, date_text)
                img = img.convert("RGB")
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
