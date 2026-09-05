import os
import uuid
import logging

import cloudinary  # type: ignore
import cloudinary.uploader  # type: ignore
from fastapi import APIRouter, File, UploadFile, HTTPException, Depends
from typing import Annotated
from models.user import User
from routers.deps import get_current_user
from dotenv import load_dotenv  # type: ignore
from starlette.concurrency import run_in_threadpool

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_UPLOAD_BYTES = int(os.getenv("MAX_IMAGE_UPLOAD_BYTES", str(10 * 1024 * 1024)))


async def read_upload_with_limit(file: UploadFile) -> bytes:
    """Read an upload in bounded chunks so an oversized file cannot exhaust memory."""
    if file.size is not None and file.size > MAX_IMAGE_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image must not exceed {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB",
        )

    chunks: list[bytes] = []
    total_size = 0
    while chunk := await file.read(1024 * 1024):
        total_size += len(chunk)
        if total_size > MAX_IMAGE_UPLOAD_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image must not exceed {MAX_IMAGE_UPLOAD_BYTES // (1024 * 1024)} MB",
            )
        chunks.append(chunk)

    if not chunks:
        raise HTTPException(status_code=400, detail="Image file is empty")
    return b"".join(chunks)


@router.post("/api/upload-image/", tags=["Upload"])
async def upload_image(current_user: Annotated[User, Depends(get_current_user)], file: UploadFile = File(...)):
    """Upload an image file to Cloudinary and return the URL"""
    try:
        if (file.content_type or "").lower() not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="File type not allowed. Use JPEG, PNG, GIF, or WebP")

        if not all((
            os.getenv("CLOUDINARY_CLOUD_NAME"),
            os.getenv("CLOUDINARY_API_KEY"),
            os.getenv("CLOUDINARY_API_SECRET"),
        )):
            logger.error("Cloudinary credentials are not configured")
            raise HTTPException(status_code=503, detail="Image upload service is not configured")

        file_content = await read_upload_with_limit(file)
        # Cloudinary's SDK performs a blocking network request.  Moving it to a
        # worker thread keeps unrelated API requests responsive while an image
        # is uploading.
        response = await run_in_threadpool(
            cloudinary.uploader.upload,
            file_content,
            folder="restaurant_images",
            public_id=f"{uuid.uuid4()}",
            resource_type="image",
        )

        return {
            "filename": response.get("original_filename"),
            "url": response.get("secure_url"),
            "size": response.get("bytes")
        }
    except HTTPException:
        raise
    except Exception:
        logger.exception("Cloudinary image upload failed")
        raise HTTPException(status_code=502, detail="Image upload failed. Please try again.")
    finally:
        await file.close()
