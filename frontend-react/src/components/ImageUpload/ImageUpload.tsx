import React, { useState, useRef } from 'react';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  images?: string[];
  onImagesChange?: (imageUrls: string[]) => void;
  onUpload?: (imageUrl: string) => void; // for backward compatibility if any
  onError?: (error: string) => void;
  maxSize?: number; // in MB
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  images = [],
  onImagesChange,
  onUpload, 
  onError, 
  maxSize = 5, 
  disabled = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      const msg = 'Vui lòng chọn tệp hình ảnh';
      setError(msg);
      onError?.(msg);
      throw new Error(msg);
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      const msg = `Kích thước tệp không được vượt quá ${maxSize}MB`;
      setError(msg);
      onError?.(msg);
      throw new Error(msg);
    }

    const formData = new FormData();
    formData.append('file', file);

    const apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
    const response = await fetch(`${apiBase}/api/upload-image/`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    // Use the URL returned from backend (could be local or cloudinary)
    const url = data.url.startsWith('http') ? data.url : `${apiBase}${data.url}`;
    return url;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setLoading(true);

    try {
      const uploadPromises = Array.from(files).map(file => processFile(file));
      const newUrls = await Promise.all(uploadPromises);
      
      if (onImagesChange) {
        onImagesChange([...images, ...newUrls]);
      }
      if (onUpload && newUrls.length > 0) {
        // Backward compatibility for single upload
        onUpload(newUrls[0]);
      }
    } catch (err: any) {
      const msg = err.message || 'Tải lên thất bại';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (fileInputRef.current) {
        fileInputRef.current.files = files;
      }
      const event = {
        target: { files },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  };

  const removeImage = (indexToRemove: number) => {
    if (disabled) return;
    const newImages = images.filter((_, index) => index !== indexToRemove);
    if (onImagesChange) {
      onImagesChange(newImages);
    }
  };

  return (
    <div className={styles.container}>
      {images.length > 0 && (
        <div className={styles.imageGrid}>
          {images.map((imgUrl, index) => (
            <div key={index} className={styles.imageItem}>
              <img src={imgUrl} alt={`Preview ${index}`} className={styles.previewImage} />
              <button 
                type="button" 
                className={styles.removeButton} 
                onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                disabled={disabled}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={`${styles.uploadBox} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={styles.uploadContent}>
          <div className={styles.uploadIcon}>📷</div>
          <p className={styles.uploadText}>
            Kéo & thả hình ảnh hoặc <span>chọn tệp</span>
          </p>
          <p className={styles.uploadHint}>
            Hỗ trợ: JPG, PNG, GIF, WebP (Tối đa {maxSize}MB)
          </p>
          {loading && <div className={styles.loadingOverlay}>Đang tải...</div>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          disabled={disabled || loading}
          className={styles.input}
        />
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}
    </div>
  );
};

export default ImageUpload;