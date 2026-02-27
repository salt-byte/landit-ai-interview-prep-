"""
File storage service. Uses local filesystem by default.
Can be swapped to S3 by replacing upload_file/get_file_path.
"""
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile
from config import settings


async def upload_file(file: UploadFile, subfolder: str = "") -> tuple[str, int]:
    """
    Save uploaded file to local storage.
    Returns (file_path, file_size_bytes).
    """
    upload_dir = settings.upload_path
    if subfolder:
        upload_dir = upload_dir / subfolder
        upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename preserving extension
    ext = Path(file.filename or "file").suffix
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest = upload_dir / unique_name

    content = await file.read()
    async with aiofiles.open(dest, "wb") as f:
        await f.write(content)

    return str(dest), len(content)


def get_file_path(stored_path: str) -> Path:
    return Path(stored_path)


async def read_text_file(file_path: str) -> str:
    """Read a text file (for resume parsing, etc.)"""
    path = Path(file_path)
    if not path.exists():
        return ""
    async with aiofiles.open(path, "r", errors="ignore") as f:
        return await f.read()


async def delete_file(file_path: str) -> bool:
    path = Path(file_path)
    if path.exists():
        path.unlink()
        return True
    return False


def detect_file_type(filename: str) -> str:
    """Heuristic file type detection by name."""
    name = filename.lower()
    if any(x in name for x in ["resume", "cv"]):
        return "Resume"
    if any(x in name for x in ["portfolio", "case", "project"]):
        return "Portfolio"
    if any(x in name for x in ["sql", "code", "sample", "script", "py", "js"]):
        return "Work Sample"
    if any(x in name for x in ["jd", "job", "description", "posting"]):
        return "Job Description"
    return "Notes"
