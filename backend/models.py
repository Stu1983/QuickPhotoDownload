from pydantic import BaseModel
from typing import Optional


class PhotoOut(BaseModel):
    id: int
    filename: str
    original_path: str
    folder_name: str
    exif_date: Optional[str] = None
    exif_date_day: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    has_raw_pair: bool = False
    raw_filename: Optional[str] = None
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None
    flags: list[str] = []


class FlagCreate(BaseModel):
    colour: str


class FolderOut(BaseModel):
    id: int
    folder_name: str
    date_prefix: str
    display_name: Optional[str] = None
    photo_count: int = 0


class FolderUpdate(BaseModel):
    display_name: str


class FolderMerge(BaseModel):
    source_folder_ids: list[int]
    target_folder_id: int
    new_name: Optional[str] = None


class DownloadRequest(BaseModel):
    photo_ids: Optional[list[int]] = None
    flag: Optional[str] = None
    day: Optional[str] = None
    size: str = "share"


class DayOut(BaseModel):
    date: str
    label: str
    count: int


class StatusOut(BaseModel):
    total_photos: int
    pending_ingest: int
    last_scan: Optional[str] = None


class FlagSummary(BaseModel):
    colour: str
    count: int
