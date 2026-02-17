import asyncio
import logging
import os
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from backend.config import config
from backend.services.file_ops import is_jpeg, should_ignore
from backend.services.ingest import ingest_file

logger = logging.getLogger(__name__)


class PhotoHandler(FileSystemEventHandler):
    """Handles new files appearing in the source directory."""

    def __init__(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop

    def on_created(self, event):
        if event.is_directory:
            return
        filepath = event.src_path
        filename = os.path.basename(filepath)

        if should_ignore(filename) or not is_jpeg(filename):
            return

        logger.info("Detected new file: %s", filepath)
        # Delay to let FTP transfer complete
        self._loop.call_soon_threadsafe(
            asyncio.ensure_future,
            self._delayed_ingest(filepath),
        )

    async def _delayed_ingest(self, filepath: str):
        # Wait for FTP transfer to finish — camera JPEGs can be 20-40MB
        # Check that file size has stabilised before ingesting
        prev_size = -1
        for _ in range(15):
            await asyncio.sleep(2)
            try:
                cur_size = os.path.getsize(filepath)
            except OSError:
                return
            if cur_size == prev_size and cur_size > 0:
                break
            prev_size = cur_size

        try:
            await ingest_file(filepath)
        except Exception as e:
            logger.error("Error ingesting watched file %s: %s", filepath, e)


_observer: Observer | None = None


def start_watcher(loop: asyncio.AbstractEventLoop):
    """Start the file system watcher in a background thread."""
    global _observer
    source_dir = config.SOURCE_DIR

    if not os.path.exists(source_dir):
        os.makedirs(source_dir, exist_ok=True)
        logger.warning("Created source directory: %s", source_dir)

    handler = PhotoHandler(loop)
    _observer = Observer()
    _observer.schedule(handler, source_dir, recursive=True)
    _observer.daemon = True
    _observer.start()
    logger.info("File watcher started on %s", source_dir)


def stop_watcher():
    """Stop the file system watcher."""
    global _observer
    if _observer:
        _observer.stop()
        _observer.join(timeout=5)
        _observer = None
        logger.info("File watcher stopped")
