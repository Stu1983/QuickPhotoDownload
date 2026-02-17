# CLAUDE.md — QuickPhotoDownload

## What This Project Is

A self-hosted photo browser and organiser designed for Unraid. Photos land in a source directory (e.g. via FTP from a camera), and the app automatically sorts them into date folders, generates thumbnails/previews, and serves a React UI for browsing, comparing, flagging, and downloading.

## Tech Stack

- **Backend**: FastAPI (Python 3.12), SQLite (aiosqlite, WAL mode), Pillow 11.1.0, Watchdog
- **Frontend**: React 18, React Router 6, Vite 6
- **Deployment**: Docker multi-stage build (Node 20 Alpine → Python 3.12 Slim), docker-compose

## Project Structure

```
backend/
  main.py              # FastAPI app, lifespan, static file serving
  config.py            # All env-var-driven settings (sizes, quality, dirs, intervals)
  database.py          # SQLite schema (photos, flags, folders tables), init
  models.py            # Pydantic DTOs (PhotoOut, FlagCreate, FolderOut, etc.)
  routes/
    photos.py          # GET /api/photos (paginated), /thumbnail, /preview, /original
    flags.py           # POST/DELETE flags, GET /api/flags/summary
    folders.py         # GET/PATCH/POST merge folders
    download.py        # POST /api/download — ZIP with size presets
    system.py          # POST /api/scan, GET /api/status, GET /api/days
  services/
    ingest.py          # Photo ingestion pipeline + _ensure_thumbnails
    scanner.py         # Periodic background scanner (6-step repair cycle)
    thumbnails.py      # generate_thumbnail, generate_preview, resize_for_download
    exif.py            # EXIF date extraction (sub-IFD aware for Pillow 10+)
    file_ops.py        # safe_move, safe_set_timestamps, should_ignore, find_matching_raw
    watcher.py         # Watchdog file system monitor with delayed ingest

frontend/src/
  App.jsx              # Router: /, /flagged, /folders
  pages/
    HomePage.jsx       # Grid + viewer + compare orchestration
    FlaggedPage.jsx    # Flagged-only view with download modal
    FoldersPage.jsx    # Folder list wrapper
  components/
    PhotoGrid.jsx      # Responsive grid, infinite scroll via IntersectionObserver
    PhotoCard.jsx      # Thumbnail card with flag dots, RAW badge, date overlay
    PhotoViewer.jsx    # Full-screen viewer with zoom/pan, swipe nav, flags
    CompareView.jsx    # Side-by-side and overlay comparison with navigation
    FlagBar.jsx        # 10-colour flag buttons (exports FLAG_COLOURS)
    Toolbar.jsx        # Sticky header: nav links, flag badge, rescan, fullscreen
    DayFilter.jsx      # Date dropdown from /api/days
    FlagFilter.jsx     # Colour flag dropdown
    FolderList.jsx     # Folder management with merge/rename
    FolderRenameInput.jsx
    MergeDialog.jsx
    DownloadModal.jsx  # Share/High/Original size picker
  hooks/
    usePhotos.js       # Paginated photo fetching with filters
    useFlags.js        # Flag toggle with optimistic update
    usePanZoom.js      # Mouse wheel zoom, drag pan, pinch zoom, double-tap
    usePreloader.js    # Preloads ±2 adjacent preview images
```

## Key Architecture Patterns

### Photo Ingestion Pipeline
1. File appears in `SOURCE_DIR` → Watchdog detects → waits 30s for file to stabilise
2. `ingest_file()` reads EXIF → creates/finds DDMMYY date folder → moves JPEG + paired RAW
3. Generates thumbnail (400px) and preview (2000px) via thread pool
4. Sets file atime/mtime to match EXIF date
5. Periodic scanner (every 5min) repairs missing thumbnails, cleans orphaned DB/cache entries

### Thumbnails
- Cached as `{photo_id}.jpg` in `cache/thumbs/` and `cache/previews/`
- Date overlays are CSS-based (frontend), NOT burned into images
- EXIF orientation respected via `ImageOps.exif_transpose()`

### Flagging
- 10 colours: red, blue, green, yellow, orange, purple, pink, cyan, lime, white
- Many-to-many (photos table ↔ flags table), used for filtering and batch download

### Compare View
- Two modes: side-by-side and overlay (draggable clip-path slider)
- Left photo is "anchor", right can be navigated through adjacent photos (arrow keys/buttons)
- Supports swap to change which photo is the anchor

### Zoom/Pan (PhotoViewer)
- `usePanZoom` hook handles: mouse wheel → cursor, drag pan, pinch zoom, touch pan, double-tap toggle
- When zoomed: swipe navigation disabled, nav buttons hidden, shows zoom % indicator
- Resets on photo change

## Database Schema (SQLite)

- **photos**: id, filename, original_path, folder_name, exif_date, exif_date_day, width, height, file_size, has_raw_pair, raw_filename, thumbnail_path, preview_path
- **flags**: id, photo_id (FK), colour — unique(photo_id, colour)
- **folders**: id, folder_name (unique), date_prefix, display_name, photo_count

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/photos | List (paginated, filters: day, flag, folder) |
| GET | /api/photos/:id | Single photo |
| GET | /api/photos/:id/thumbnail | 400px JPEG |
| GET | /api/photos/:id/preview | 2000px JPEG |
| GET | /api/photos/:id/original | Original file download |
| POST | /api/photos/:id/flags | Add flag |
| DELETE | /api/photos/:id/flags/:colour | Remove flag |
| GET | /api/flags/summary | Flag counts for badge |
| GET | /api/folders | List folders |
| PATCH | /api/folders/:id | Rename folder |
| POST | /api/folders/merge | Merge folders |
| POST | /api/download | ZIP download with size preset |
| POST | /api/scan | Trigger manual scan |
| GET | /api/status | System status |
| GET | /api/days | Unique dates with counts |

## Running Locally

```bash
# Backend
pip install -r requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8080

# Frontend (separate terminal)
cd frontend && npm install && npm run dev
# Vite proxies /api → localhost:8080
```

## Docker Build & Deploy

```bash
# Build
docker build -t photo-browser \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --build-arg GIT_COMMIT_DATE=$(git log -1 --format=%ci) .

# Run via docker-compose (see docker-compose.yml)
docker compose up -d
```

Key volumes: `/photos` (source + sorted), `/app/cache` (DB + thumbnails).
Port: 8580 → 8080.

There is also a `deploy.sh` script for one-liner installation on Unraid with interactive branch selection and optional `--reset-db`.

## Important Implementation Notes

- **EXIF reading** uses Pillow 10+ sub-IFD access (`exif.get_ifd(IFD.Exif)`) — the DateTimeOriginal tag lives in the EXIF sub-IFD, not the top-level IFD
- **File operations** have retry logic for Syncthing/NFS lock contention
- **RAW pairing** matches JPEG stem against all known RAW extensions (cr3, arw, nef, etc.)
- **Scan cycle** is 6 steps: ingest source → index sorted → repair thumbnails → cleanup missing → cleanup orphan cache → update folder counts
- **Frontend date formatting** is DD/MM/YYYY HH:MM:SS (UK format), rendered as CSS overlays on cards, viewer, and compare view
- Photos are ordered by `exif_date DESC, filename ASC` globally
