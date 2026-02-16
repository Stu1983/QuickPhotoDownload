# Photo Browser — Implementation Plan

A lightweight, fast photo browser for an Unraid Docker environment. Watches an FTP upload folder, auto-sorts photos into date folders, generates thumbnails, and provides a mobile-friendly UI for browsing, flagging, comparing, and bulk downloading photos for sharing.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                Docker Container                  │
│                                                  │
│  ┌──────────────┐    ┌────────────────────────┐ │
│  │  FastAPI      │    │  Background Workers     │ │
│  │  (API + SPA)  │    │  - File watcher         │ │
│  │               │    │  - Thumbnail generator   │ │
│  │  /api/*       │    │  - Periodic scanner      │ │
│  │  /static/*    │    │                          │ │
│  └──────┬───────┘    └────────────┬─────────────┘ │
│         │                         │               │
│         └────────┬────────────────┘               │
│                  │                                │
│           ┌──────▼──────┐                         │
│           │   SQLite DB  │                         │
│           │ /app/cache/  │                         │
│           └──────────────┘                         │
└─────────────────────────────────────────────────┘
         │              │              │
    /photos/source  /photos/sorted  /app/cache
    (FTP uploads)   (date folders)  (thumbs, DB)
```

### Volume Mounts

| Container Path    | Purpose                                      | Access     |
|-------------------|----------------------------------------------|------------|
| `/photos/source`  | FTP upload folder(s) — where camera uploads   | read-write |
| `/photos/sorted`  | Date-organised folder output                  | read-write |
| `/app/cache`      | Thumbnails, previews, SQLite DB               | read-write |

### Tech Stack

- **Backend**: Python 3.12, FastAPI, Uvicorn
- **Image Processing**: Pillow (thumbnails, previews, resized downloads)
- **EXIF**: Pillow EXIF or `exifread` library
- **Database**: SQLite via `aiosqlite` (async)
- **File Watching**: `watchdog` library
- **Frontend**: React (Vite), served as static files by FastAPI
- **Download**: ZIP generation via Python `zipfile` (streaming)
- **Deployment**: Single Dockerfile, multi-stage build (Node for frontend, Python for backend)

---

## 2. Database Schema

Store in `/app/cache/photobrowser.db`.

```sql
CREATE TABLE photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,              -- e.g. 'IMG_1234.JPG'
    original_path TEXT NOT NULL,         -- path relative to /photos/sorted
    folder_name TEXT NOT NULL,           -- e.g. '260216' or '260216 Kids Birthday'
    exif_date TEXT,                      -- ISO 8601 from EXIF DateTimeOriginal
    exif_date_day TEXT,                  -- just the date part YYYY-MM-DD for filtering
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    has_raw_pair BOOLEAN DEFAULT FALSE,  -- whether a matching RAW file exists
    raw_filename TEXT,                   -- e.g. 'IMG_1234.CR3'
    thumbnail_path TEXT,                 -- relative to /app/cache/thumbs/
    preview_path TEXT,                   -- relative to /app/cache/previews/
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(original_path, filename)
);

CREATE TABLE flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    colour TEXT NOT NULL,                -- one of the 10 defined colours
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(photo_id, colour)
);

CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_name TEXT NOT NULL UNIQUE,    -- e.g. '260216 Kids Birthday'
    date_prefix TEXT NOT NULL,           -- e.g. '260216'
    display_name TEXT,                   -- e.g. 'Kids Birthday' (user-provided label)
    photo_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_photos_folder ON photos(folder_name);
CREATE INDEX idx_photos_day ON photos(exif_date_day);
CREATE INDEX idx_flags_photo ON flags(photo_id);
CREATE INDEX idx_flags_colour ON flags(colour);
CREATE INDEX idx_folders_date ON folders(date_prefix);
```

---

## 3. Backend — API Endpoints

### 3.1 Photos

```
GET  /api/photos
     ?day=YYYY-MM-DD          — filter by EXIF day
     ?flag=red                 — filter by flag colour
     ?folder=260216            — filter by folder
     ?page=1&per_page=50       — pagination
     Returns: array of photo objects with thumbnail URLs and flag data

GET  /api/photos/{id}
     Returns: full photo metadata including preview URL

GET  /api/photos/{id}/thumbnail    — serves thumbnail image (~400px)
GET  /api/photos/{id}/preview      — serves preview image (~2000px)
GET  /api/photos/{id}/original     — serves original JPEG (streaming)
```

### 3.2 Flags

```
POST   /api/photos/{id}/flags
       Body: { "colour": "red" }
       Adds a flag to a photo

DELETE /api/photos/{id}/flags/{colour}
       Removes a specific flag

GET    /api/flags/summary
       Returns: count of photos per flag colour (for toolbar badges)
```

### 3.3 Bulk Download

```
POST  /api/download
      Body: {
        "photo_ids": [1, 2, 3],        — or use filters:
        "flag": "red",                   — download all red-flagged
        "day": "2026-02-16",            — download all from a day
        "size": "share"                  — "share" | "high" | "original"
      }
      Returns: streaming ZIP file

      Size presets:
        "share"    → 2048px longest edge, 80% JPEG quality  (default)
        "high"     → 4096px longest edge, 90% JPEG quality
        "original" → untouched JPEG from camera
```

### 3.4 Folders

```
GET    /api/folders
       Returns: list of all folders with photo counts

PATCH  /api/folders/{id}
       Body: { "display_name": "Kids Birthday" }
       Renames folder on disk: 260216 → 260216 Kids Birthday
       Updates all photo paths in DB

POST   /api/folders/merge
       Body: {
         "source_folder_ids": [2, 3],
         "target_folder_id": 1,
         "new_name": "270216 - 010316 Half Term"  (optional)
       }
       Physically moves files, updates DB paths
```

### 3.5 Day Filter

```
GET  /api/days
     Returns: [
       { "date": "2026-02-16", "label": "Mon 16 Feb 2026", "count": 47 },
       { "date": "2026-02-15", "label": "Sun 15 Feb 2026", "count": 12 }
     ]
```

### 3.6 System

```
POST /api/scan
     Triggers a manual rescan of source + sorted folders

GET  /api/status
     Returns: { "total_photos": 234, "pending_ingest": 3, "last_scan": "..." }
```

---

## 4. Background Services

### 4.1 File Watcher (Primary Ingest)

Runs continuously using `watchdog` to monitor `/photos/source` recursively.

**On new JPEG detected:**

1. Wait briefly (2 seconds) for file write to complete (FTP transfers)
2. Verify file is a JPEG (by extension: `.jpg`, `.jpeg` — case insensitive)
3. Skip RAW files (`.cr3`, `.arw`, `.nef`, `.raf`, `.cr2`, `.dng`, `.orf`, `.rw2`)
4. Skip Syncthing metadata (`.stignore`, `.stfolder/`, `.stversions/`)
5. Read EXIF `DateTimeOriginal` → extract date → format as `DDMMYY`
6. Check if a folder matching that date prefix already exists in `/photos/sorted/` (could be `260216` or `260216 Kids Birthday`)
7. Move JPEG to that folder (create if needed)
8. Look for matching RAW file (same stem, any raw extension) → move that too
9. **Fix timestamps**: set file created/modified dates to EXIF DateTimeOriginal using `os.utime()`
10. Generate thumbnail (400px longest edge) → save to `/app/cache/thumbs/{id}.jpg`
11. Generate preview (2000px longest edge) → save to `/app/cache/previews/{id}.jpg`
12. Insert record into SQLite

**Syncthing-safe file operations:**

```python
import time
import shutil

def safe_move(src, dst, retries=5, delay=2):
    """Move a file with retry logic for Syncthing locks."""
    for attempt in range(retries):
        try:
            shutil.move(src, dst)
            return True
        except (PermissionError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                logger.error(f"Failed to move {src} after {retries} attempts: {e}")
                return False

def safe_set_timestamps(filepath, exif_datetime, retries=5, delay=2):
    """Set file timestamps with retry logic."""
    ts = exif_datetime.timestamp()
    for attempt in range(retries):
        try:
            os.utime(filepath, (ts, ts))
            return True
        except (PermissionError, OSError) as e:
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                logger.error(f"Failed to set timestamps on {filepath}: {e}")
                return False
```

### 4.2 Periodic Scanner

Runs every N minutes (configurable, default 5 minutes). Handles cases the file watcher might miss (e.g., container restart, network glitch).

**Scan logic:**

1. List all JPEG files in `/photos/source` (recursive) — any that the watcher missed get processed via the same ingest pipeline
2. List all JPEG files in `/photos/sorted` (recursive)
3. For each file in sorted: check if it exists in DB. If not, add it (generate thumbs etc.)
4. For each record in DB: check if file still exists on disk. If not, remove record and delete cached thumbnails/previews
5. Update folder photo counts

### 4.3 Thumbnail Generator

Shared service used by both watcher and scanner.

```python
from PIL import Image

THUMB_SIZE = 400
PREVIEW_SIZE = 2000
JPEG_QUALITY_THUMB = 80
JPEG_QUALITY_PREVIEW = 85

def generate_thumbnail(source_path, output_path, max_size=THUMB_SIZE):
    """Generate a thumbnail respecting EXIF orientation."""
    img = Image.open(source_path)
    # Auto-rotate based on EXIF orientation tag
    img = ImageOps.exif_transpose(img)
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    img.save(output_path, "JPEG", quality=JPEG_QUALITY_THUMB)

def generate_preview(source_path, output_path, max_size=PREVIEW_SIZE):
    img = Image.open(source_path)
    img = ImageOps.exif_transpose(img)
    img.thumbnail((max_size, max_size), Image.LANCZOS)
    img.save(output_path, "JPEG", quality=JPEG_QUALITY_PREVIEW)
```

---

## 5. Frontend — React SPA

### 5.1 Pages / Views

#### Grid View (Home)

- **Header toolbar**: Day filter dropdown, Flag filter dropdown, Rescan button, Flagged count badges
- **Photo grid**: Responsive CSS grid (3-4 columns on mobile, more on desktop)
- Each cell shows thumbnail with any flag dots overlaid in corner
- Lazy loading via Intersection Observer
- Infinite scroll or pagination
- Tap thumbnail → opens Single Photo View

#### Single Photo View

- Full-screen preview image with dark background
- **Navigation**: left/right arrows (keyboard), swipe gestures (touch)
- **Preloading**: preload prev + next 2 previews for instant navigation
- **Flag bar**: row of 10 colour circles at bottom — tap to toggle, filled = active
- **Actions**: Compare button (adds to compare selection), Download single photo
- Back button returns to grid (maintaining scroll position)

#### Compare View

- Activated when 2 photos are selected for comparison
- Side-by-side layout with draggable vertical divider
- Both images zoom and pan together (linked transforms)
- Swap button to switch left/right
- Flag buttons for each side
- On mobile: may need to stack vertically with horizontal divider or allow rotation to landscape

#### Flagged View

- Filtered grid showing only photos with flags
- Sub-filter by specific colour
- "Download All Flagged" button with size picker
- "Clear All Flags" with confirmation dialog

#### Folders View

- List of all date folders with photo counts and thumbnail preview
- Inline rename: click folder name to edit, adds event name
- Multi-select for merge operation
- Shows folder date range

### 5.2 Components

```
src/
├── components/
│   ├── PhotoGrid.jsx          — responsive thumbnail grid
│   ├── PhotoCard.jsx          — single grid cell with flag dots
│   ├── PhotoViewer.jsx        — full-screen single photo carousel
│   ├── FlagBar.jsx            — row of 10 colour toggles
│   ├── CompareView.jsx        — side-by-side with divider
│   ├── DayFilter.jsx          — dropdown populated from /api/days
│   ├── FlagFilter.jsx         — filter by flag colour
│   ├── DownloadModal.jsx      — size picker + confirm for bulk download
│   ├── FolderList.jsx         — folder management view
│   ├── FolderRenameInput.jsx  — inline rename with save
│   ├── MergeDialog.jsx        — merge folder confirmation
│   └── Toolbar.jsx            — top bar with filters and actions
├── hooks/
│   ├── usePhotos.js           — fetch + cache photo list with filters
│   ├── useFlags.js            — flag toggle + state management
│   ├── usePreloader.js        — preload adjacent preview images
│   └── usePanZoom.js          — linked pan/zoom for compare view
├── pages/
│   ├── HomePage.jsx
│   ├── FlaggedPage.jsx
│   └── FoldersPage.jsx
├── App.jsx
└── main.jsx
```

### 5.3 Flag Colour Definitions

```javascript
const FLAG_COLOURS = [
  { id: 'red',    hex: '#EF4444', label: 'Red' },
  { id: 'blue',   hex: '#3B82F6', label: 'Blue' },
  { id: 'green',  hex: '#22C55E', label: 'Green' },
  { id: 'yellow', hex: '#EAB308', label: 'Yellow' },
  { id: 'orange', hex: '#F97316', label: 'Orange' },
  { id: 'purple', hex: '#A855F7', label: 'Purple' },
  { id: 'pink',   hex: '#EC4899', label: 'Pink' },
  { id: 'cyan',   hex: '#06B6D4', label: 'Cyan' },
  { id: 'lime',   hex: '#84CC16', label: 'Lime' },
  { id: 'white',  hex: '#F5F5F5', label: 'White' },
];
```

### 5.4 Performance Considerations

- **Thumbnail grid**: use `loading="lazy"` on img elements + Intersection Observer
- **Preview carousel**: preload N-2, N-1, N+1, N+2 images in hidden `<img>` elements
- **Thumbnail size**: 400px is small enough for fast load, big enough for retina grid cells
- **Preview size**: 2000px balances quality vs speed for a 69MP camera's output
- **HTTP caching**: set `Cache-Control: max-age=86400` on thumbnail/preview endpoints since images are immutable once generated
- **Grid scroll position**: preserve on back navigation using a scroll restoration hook

---

## 6. Docker Configuration

### 6.1 Dockerfile

```dockerfile
# Stage 1: Build React frontend
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Python backend
FROM python:3.12-slim
WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend /app/frontend/dist ./static/

# Create cache directory
RUN mkdir -p /app/cache/thumbs /app/cache/previews

EXPOSE 8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

### 6.2 docker-compose.yml (for Unraid)

```yaml
version: '3.8'
services:
  photo-browser:
    build: .
    container_name: photo-browser
    ports:
      - "8580:8080"
    volumes:
      - /mnt/user/camera-uploads:/photos/source
      - /mnt/user/photos-sorted:/photos/sorted
      - /mnt/user/photo-browser-cache:/app/cache
    environment:
      - SCAN_INTERVAL_MINUTES=5
      - THUMB_SIZE=400
      - PREVIEW_SIZE=2000
      - LOG_LEVEL=info
    restart: unless-stopped
```

### 6.3 Environment Variables

| Variable                | Default | Description                                |
|-------------------------|---------|--------------------------------------------|
| `SCAN_INTERVAL_MINUTES` | `5`     | Minutes between periodic full scans        |
| `THUMB_SIZE`            | `400`   | Thumbnail longest edge in pixels           |
| `PREVIEW_SIZE`          | `2000`  | Preview longest edge in pixels             |
| `SHARE_SIZE`            | `2048`  | "Share" download size (longest edge)       |
| `HIGH_SIZE`             | `4096`  | "High quality" download size               |
| `SHARE_QUALITY`         | `80`    | JPEG quality for share downloads           |
| `HIGH_QUALITY`          | `90`    | JPEG quality for high downloads            |
| `FILE_OP_RETRIES`       | `5`     | Retry attempts for file moves (Syncthing)  |
| `FILE_OP_RETRY_DELAY`   | `2`     | Seconds between retries                    |
| `LOG_LEVEL`             | `info`  | Logging level                              |
| `RAW_EXTENSIONS`        | `cr3,arw,nef,raf,cr2,dng,orf,rw2` | Recognised RAW extensions |

---

## 7. Implementation Order

Build in this sequence, each phase producing a working increment:

### Phase 1 — Core Backend + Ingest Pipeline

1. FastAPI project scaffolding with config/environment handling
2. SQLite database setup with schema and migrations
3. EXIF reading utility (extract DateTimeOriginal, dimensions)
4. Thumbnail and preview generation service
5. File watcher service monitoring `/photos/source`
6. Auto-sort logic: read EXIF date → find/create date folder in `/photos/sorted` → move JPG + RAW → fix timestamps
7. Syncthing-safe file operation helpers (retry logic)
8. Periodic scanner (incremental: detect new files, detect removed files)
9. Basic API endpoints: `GET /api/photos`, `GET /api/photos/{id}/thumbnail`, `GET /api/photos/{id}/preview`

### Phase 2 — Browsing Frontend

1. React + Vite project setup
2. Photo grid component with lazy loading thumbnails
3. Day filter dropdown (from `GET /api/days`)
4. Single photo viewer with preview images
5. Left/right navigation with keyboard + swipe
6. Preview preloading for adjacent images
7. Serve SPA as static files from FastAPI

### Phase 3 — Flags

1. Flag API endpoints (add, remove, summary)
2. Flag bar component (10 colour circles)
3. Flag dots on grid thumbnails
4. Flag filter in toolbar
5. Flagged photos view

### Phase 4 — Compare View

1. Photo selection mechanism (pick 2 for comparison)
2. Side-by-side layout with draggable divider
3. Linked pan and zoom
4. Swap button
5. Flag each side from compare view

### Phase 5 — Bulk Download

1. ZIP generation endpoint with streaming
2. Image resizing for share/high/original presets
3. Download modal with size picker
4. Download scoped by flag colour or day filter

### Phase 6 — Folder Management

1. Folder list API and view
2. Inline folder rename (add event name)
3. Folder merge with file move + DB update
4. Handle subsequent uploads finding renamed folders by date prefix

### Phase 7 — Polish + Docker

1. Mobile responsiveness pass
2. Error handling and loading states
3. Dockerfile with multi-stage build
4. docker-compose.yml for Unraid
5. README with setup instructions

---

## 8. File Ignore Rules

The app should skip/ignore the following files and directories:

**RAW files** (don't display, but do move alongside matching JPEGs):
`.cr3`, `.arw`, `.nef`, `.raf`, `.cr2`, `.dng`, `.orf`, `.rw2`

**Syncthing metadata** (ignore completely):
`.stignore`, `.stfolder/`, `.stversions/`, any file starting with `.st`

**System files**:
`.DS_Store`, `Thumbs.db`, `desktop.ini`

---

## 9. Key UX Details

- **Sorting**: Photos sorted by EXIF date descending (newest first) by default
- **Day dropdown format**: "Mon 16 Feb 2026 (47)" showing count
- **Flag persistence**: Flags survive across sessions (stored in SQLite), cleared only explicitly or when photo disappears from disk
- **Missing files**: No error messages when files disappear — they silently drop from the index on next scan. This is expected behaviour.
- **Compare on mobile**: Encourage landscape orientation; show a rotate-device hint if in portrait
- **Download filename**: ZIP named with context, e.g. `photos-2026-02-16-red-flag.zip` or `photos-kids-birthday.zip`
