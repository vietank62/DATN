import os
import shutil
import uuid
from fastapi import APIRouter, File, UploadFile, HTTPException
from pathlib import Path

router = APIRouter()

# Create uploads directory if it doesn't exist
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/api/upload-image/", tags=["Upload"])
async def upload_image(file: UploadFile = File(...)):
    """Upload an image file and return the URL"""
    try:
        # Validate file type
        allowed_types = {"image/jpeg", "image/png", "image/gif", "image/webp"}
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="File type not allowed. Use JPEG, PNG, GIF, or WebP")
        
        # Validate file size (max 5MB)
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 5MB limit")
        
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Return URL (adjust based on your deployment)
        return {
            "filename": unique_filename,
            "url": f"/uploads/{unique_filename}",
            "size": len(file_content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/uploads/{filename}", tags=["Upload"])
async def get_image(filename: str):
    """Serve uploaded image file"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return file_path
