import os
import uuid
import cloudinary  # type: ignore
import cloudinary.uploader  # type: ignore
from fastapi import APIRouter, File, UploadFile, HTTPException
from dotenv import load_dotenv  # type: ignore

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True
)

router = APIRouter()


@router.post("/api/upload-image/", tags=["Upload"])
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file to Cloudinary and return the URL"""
    try:
        allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="File type not allowed. Use JPEG, PNG, GIF, or WebP")

        file_content = await file.read()

        response = cloudinary.uploader.upload(
            file_content,
            folder="restaurant_images",
            public_id=f"{uuid.uuid4()}"
        )

        return {
            "filename": response.get("original_filename"),
            "url": response.get("secure_url"),
            "size": response.get("bytes")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
