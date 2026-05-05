import os
import uuid
import cloudinary
import cloudinary.uploader
from fastapi import APIRouter, File, UploadFile, HTTPException
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Cloudinary configuration (You will need to set these in your .env file)
# CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
# Alternatively, set CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>

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
        # Validate file type
        allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="File type not allowed. Use JPEG, PNG, GIF, or WebP")
        
        # Read file
        file_content = await file.read()
        
        # Upload to Cloudinary
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
