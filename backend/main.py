import asyncio
import logging
import os

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import config
from backend.database import init_db
from backend.routes import photos, flags, folders, download, system
from backend.services.scanner import periodic_scanner
from backend.services.watcher import start_watcher, stop_watcher

# Configure logging
logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

_scanner_task: asyncio.Task | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scanner_task

    # Startup
    logger.info("Starting Photo Browser...")

    # Ensure directories exist
    for d in [config.SOURCE_DIR, config.SORTED_DIR, config.THUMBS_DIR, config.PREVIEWS_DIR]:
        os.makedirs(d, exist_ok=True)

    # Initialize database
    await init_db()

    # Start file watcher
    loop = asyncio.get_event_loop()
    start_watcher(loop)

    # Start periodic scanner
    _scanner_task = asyncio.create_task(periodic_scanner())

    logger.info("Photo Browser started successfully")
    yield

    # Shutdown
    logger.info("Shutting down Photo Browser...")
    stop_watcher()
    if _scanner_task:
        _scanner_task.cancel()
        try:
            await _scanner_task
        except asyncio.CancelledError:
            pass
    logger.info("Photo Browser stopped")


app = FastAPI(title="Photo Browser", lifespan=lifespan)

# Include API routes
app.include_router(photos.router)
app.include_router(flags.router)
app.include_router(folders.router)
app.include_router(download.router)
app.include_router(system.router)

# Serve static frontend files
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve the SPA for any non-API route."""
        # Try to serve the exact file first
        file_path = os.path.join(static_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Fall back to index.html for SPA routing
        return FileResponse(os.path.join(static_dir, "index.html"))
