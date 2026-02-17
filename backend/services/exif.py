import logging
from datetime import datetime
from typing import Optional
from PIL import Image
from PIL.ExifTags import Base as ExifBase

logger = logging.getLogger(__name__)


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


def read_exif(filepath: str) -> ExifData:
    """Read EXIF data from an image file."""
    try:
        with Image.open(filepath) as img:
            width, height = img.size
            exif_dict = img.getexif()
            date_taken = None

            if exif_dict:
                # Try DateTimeOriginal first
                date_str = exif_dict.get(ExifBase.DateTimeOriginal)
                if not date_str:
                    date_str = exif_dict.get(ExifBase.DateTimeDigitized)
                if not date_str:
                    date_str = exif_dict.get(ExifBase.DateTime)

                if date_str:
                    # EXIF dates are typically "YYYY:MM:DD HH:MM:SS"
                    try:
                        date_taken = datetime.strptime(str(date_str), "%Y:%m:%d %H:%M:%S")
                    except ValueError:
                        logger.warning("Could not parse EXIF date: %s", date_str)

            return ExifData(date_taken=date_taken, width=width, height=height)
    except Exception as e:
        logger.error("Error reading EXIF from %s: %s", filepath, e)
        return ExifData()
