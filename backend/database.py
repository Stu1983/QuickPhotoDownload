import aiosqlite
import os
import logging

from backend.config import config

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    folder_name TEXT NOT NULL,
    exif_date TEXT,
    exif_date_day TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    has_raw_pair BOOLEAN DEFAULT FALSE,
    raw_filename TEXT,
    thumbnail_path TEXT,
    preview_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_path, filename)
);

CREATE TABLE IF NOT EXISTS flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    colour TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(photo_id, colour)
);

CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_name TEXT NOT NULL UNIQUE,
    date_prefix TEXT NOT NULL,
    display_name TEXT,
    photo_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photos_folder ON photos(folder_name);
CREATE INDEX IF NOT EXISTS idx_photos_day ON photos(exif_date_day);
CREATE INDEX IF NOT EXISTS idx_flags_photo ON flags(photo_id);
CREATE INDEX IF NOT EXISTS idx_flags_colour ON flags(colour);
CREATE INDEX IF NOT EXISTS idx_folders_date ON folders(date_prefix);
"""


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(config.DB_PATH)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    os.makedirs(os.path.dirname(config.DB_PATH), exist_ok=True)
    db = await get_db()
    try:
        await db.executescript(SCHEMA)
        await db.commit()
        logger.info("Database initialized at %s", config.DB_PATH)
    finally:
        await db.close()
