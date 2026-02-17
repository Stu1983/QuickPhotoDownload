import os
import shutil
from fastapi import APIRouter, HTTPException

from backend.config import config
from backend.database import get_db
from backend.models import FolderMerge, FolderOut, FolderUpdate

router = APIRouter(prefix="/api/folders", tags=["folders"])


@router.get("", response_model=list[FolderOut])
async def list_folders():
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, folder_name, date_prefix, display_name, photo_count FROM folders ORDER BY date_prefix DESC"
        )
        return [
            FolderOut(
                id=row[0],
                folder_name=row[1],
                date_prefix=row[2],
                display_name=row[3],
                photo_count=row[4],
            )
            for row in rows
        ]
    finally:
        await db.close()


@router.patch("/{folder_id}", response_model=FolderOut)
async def rename_folder(folder_id: int, update: FolderUpdate):
    db = await get_db()
    try:
        rows = await db.execute_fetchall(
            "SELECT id, folder_name, date_prefix FROM folders WHERE id = ?", (folder_id,)
        )
        if not rows:
            raise HTTPException(status_code=404, detail="Folder not found")

        old_name = rows[0][1]
        date_prefix = rows[0][2]
        new_name = f"{date_prefix} {update.display_name}".strip()

        old_path = os.path.join(config.SORTED_DIR, old_name)
        new_path = os.path.join(config.SORTED_DIR, new_name)

        if old_name != new_name and os.path.exists(old_path):
            os.rename(old_path, new_path)

        # Update DB
        await db.execute(
            "UPDATE folders SET folder_name = ?, display_name = ? WHERE id = ?",
            (new_name, update.display_name, folder_id),
        )
        await db.execute(
            "UPDATE photos SET folder_name = ?, original_path = ? WHERE folder_name = ?",
            (new_name, new_name, old_name),
        )
        await db.commit()

        return FolderOut(
            id=folder_id,
            folder_name=new_name,
            date_prefix=date_prefix,
            display_name=update.display_name,
            photo_count=rows[0][2] if len(rows[0]) > 3 else 0,
        )
    finally:
        await db.close()


@router.post("/merge")
async def merge_folders(merge: FolderMerge):
    db = await get_db()
    try:
        # Get target folder
        target_rows = await db.execute_fetchall(
            "SELECT folder_name, date_prefix FROM folders WHERE id = ?", (merge.target_folder_id,)
        )
        if not target_rows:
            raise HTTPException(status_code=404, detail="Target folder not found")

        target_name = target_rows[0][0]
        target_path = os.path.join(config.SORTED_DIR, target_name)

        for source_id in merge.source_folder_ids:
            if source_id == merge.target_folder_id:
                continue

            source_rows = await db.execute_fetchall(
                "SELECT folder_name FROM folders WHERE id = ?", (source_id,)
            )
            if not source_rows:
                continue

            source_name = source_rows[0][0]
            source_path = os.path.join(config.SORTED_DIR, source_name)

            if os.path.exists(source_path):
                for f in os.listdir(source_path):
                    src_file = os.path.join(source_path, f)
                    dst_file = os.path.join(target_path, f)
                    if os.path.isfile(src_file):
                        shutil.move(src_file, dst_file)

                # Remove empty source directory
                if not os.listdir(source_path):
                    os.rmdir(source_path)

            # Update DB paths
            await db.execute(
                "UPDATE photos SET folder_name = ?, original_path = ? WHERE folder_name = ?",
                (target_name, target_name, source_name),
            )
            await db.execute("DELETE FROM folders WHERE id = ?", (source_id,))

        # Optionally rename target
        if merge.new_name:
            old_target_path = target_path
            new_target_path = os.path.join(config.SORTED_DIR, merge.new_name)
            if os.path.exists(old_target_path) and old_target_path != new_target_path:
                os.rename(old_target_path, new_target_path)
            await db.execute(
                "UPDATE folders SET folder_name = ? WHERE id = ?",
                (merge.new_name, merge.target_folder_id),
            )
            await db.execute(
                "UPDATE photos SET folder_name = ?, original_path = ? WHERE folder_name = ?",
                (merge.new_name, merge.new_name, target_name),
            )

        # Update count
        final_name = merge.new_name or target_name
        await db.execute(
            "UPDATE folders SET photo_count = (SELECT COUNT(*) FROM photos WHERE folder_name = ?) WHERE id = ?",
            (final_name, merge.target_folder_id),
        )
        await db.commit()

        return {"status": "ok"}
    finally:
        await db.close()
