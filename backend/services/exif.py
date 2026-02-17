import logging
from datetime import datetime
from typing import Optional

from PIL import Image
from PIL.ExifTags import Base as ExifBase, IFD

logger = logging.getLogger(__name__)

# EXIF sub-IFD tag IDs for date fields
_TAG_DATE_ORIGINAL = 0x9003   # DateTimeOriginal
_TAG_DATE_DIGITIZED = 0x9004  # DateTimeDigitized


class ExifData:
    def __init__(
        self,
        date_taken: Optional[datetime] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ):
        self.date_taken = date_taken
        self.width = width
        self.height = height

    @property
    def date_folder(self) -> Optional[str]:
        """Return DDMMYY format for folder naming."""
        if self.date_taken:
            return self.date_taken.strftime("%d%m%y")
        return None

    @property
    def date_day(self) -> Optional[str]:
        """Return YYYY-MM-DD for filtering."""
        if self.date_taken:
            return self.date_taken.strftime("%Y-%m-%d")
        return None

    @property
    def iso_date(self) -> Optional[str]:
        """Return ISO 8601 string."""
        if self.date_taken:
            return self.date_taken.isoformat()
        return None


def _parse_exif_date(date_str) -> Optional[datetime]:
    """Parse an EXIF date string like 'YYYY:MM:DD HH:MM:SS'."""
    if not date_str:
        return None
    try:
        return datetime.strptime(str(date_str), "%Y:%m:%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def read_exif(filepath: str) -> ExifData:
    """Read EXIF data from an image file.

    In Pillow 10+, DateTimeOriginal and DateTimeDigitized live in the
    EXIF sub-IFD (0x8769) and must be accessed via get_ifd(), not from
    the top-level getexif() dict.
    """
    try:
        with Image.open(filepath) as img:
            width, height = img.size
            exif = img.getexif()
            date_taken = None
            source_field = None

            if exif:
                # Access the EXIF sub-IFD where DateTimeOriginal lives
                exif_ifd = exif.get_ifd(IFD.Exif)

                if exif_ifd:
                    date_taken = _parse_exif_date(exif_ifd.get(_TAG_DATE_ORIGINAL))
                    if date_taken:
                        source_field = "DateTimeOriginal (EXIF IFD)"

                    if not date_taken:
                        date_taken = _parse_exif_date(exif_ifd.get(_TAG_DATE_DIGITIZED))
                        if date_taken:
                            source_field = "DateTimeDigitized (EXIF IFD)"

                # Fallback: DateTime in main IFD (less reliable — updated on file save)
                if not date_taken:
                    date_taken = _parse_exif_date(exif.get(ExifBase.DateTime))
                    if date_taken:
                        source_field = "DateTime (main IFD, fallback)"

            if date_taken:
                logger.info("EXIF %s: %s → %s", source_field, date_taken.isoformat(), filepath)
            else:
                logger.warning("No EXIF date found in %s", filepath)

            return ExifData(date_taken=date_taken, width=width, height=height)
    except Exception as e:
        logger.error("Error reading EXIF from %s: %s", filepath, e)
        return ExifData()
