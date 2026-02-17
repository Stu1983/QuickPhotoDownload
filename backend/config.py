import os


class Config:
    SCAN_INTERVAL_MINUTES = int(os.environ.get("SCAN_INTERVAL_MINUTES", "5"))
    THUMB_SIZE = int(os.environ.get("THUMB_SIZE", "400"))
    PREVIEW_SIZE = int(os.environ.get("PREVIEW_SIZE", "2000"))
    SHARE_SIZE = int(os.environ.get("SHARE_SIZE", "2048"))
    HIGH_SIZE = int(os.environ.get("HIGH_SIZE", "4096"))
    SHARE_QUALITY = int(os.environ.get("SHARE_QUALITY", "80"))
    HIGH_QUALITY = int(os.environ.get("HIGH_QUALITY", "90"))
    THUMB_QUALITY = int(os.environ.get("THUMB_QUALITY", "80"))
    PREVIEW_QUALITY = int(os.environ.get("PREVIEW_QUALITY", "85"))
    FILE_OP_RETRIES = int(os.environ.get("FILE_OP_RETRIES", "5"))
    FILE_OP_RETRY_DELAY = int(os.environ.get("FILE_OP_RETRY_DELAY", "2"))
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "info").upper()

    SOURCE_DIR = os.environ.get("SOURCE_DIR", "/photos/source")
    SORTED_DIR = os.environ.get("SORTED_DIR", "/photos/sorted")
    CACHE_DIR = os.environ.get("CACHE_DIR", "/app/cache")
    DB_PATH = os.path.join(CACHE_DIR, "photobrowser.db")
    THUMBS_DIR = os.path.join(CACHE_DIR, "thumbs")
    PREVIEWS_DIR = os.path.join(CACHE_DIR, "previews")

    RAW_EXTENSIONS_STR = os.environ.get("RAW_EXTENSIONS", "cr3,arw,nef,raf,cr2,dng,orf,rw2")
    RAW_EXTENSIONS = {f".{ext.strip().lower()}" for ext in RAW_EXTENSIONS_STR.split(",")}

    JPEG_EXTENSIONS = {".jpg", ".jpeg"}

    IGNORE_PREFIXES = {".st"}
    IGNORE_FILES = {".ds_store", "thumbs.db", "desktop.ini"}
    IGNORE_DIRS = {".stfolder", ".stversions"}


config = Config()
