import React, { useState, useRef } from 'react';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  onUpload: (imageUrl: string) => void;
  onError?: (error: string) => void;
  maxSize?: number; // in MB
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onUpload, 
  onError, 
  maxSize = 5, 
  disabled = false 
}) => {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    // Validate file type
    if (!file.type.startsWith('image/')) {
      const msg = 'Vui lòng chọn tệp hình ảnh';
      setError(msg);
      onError?.(msg);
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      const msg = `Kích thước tệp không được vượt quá ${maxSize}MB`;
      setError(msg);
      onError?.(msg);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/upload-image/', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      onUpload(`http://localhost:8000${data.url}`);
    } catch (err: any) {
      const msg = err.message || 'Tải lên thất bại';
      setError(msg);
      onError?.(msg);
      setPreview(null);
    } finally {
      setLoading(false);
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
      fileInputRef.current!.files = files;
      const event = {
        target: { files },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event);
    }
  };

  return (
    <div className={styles.container}>
      <div
        className={`${styles.uploadBox} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {preview ? (
          <div className={styles.preview}>
            <img src={preview} alt="Preview" className={styles.previewImage} />
            {loading && <div className={styles.loadingOverlay}>Đang tải...</div>}
          </div>
        ) : (
          <div className={styles.uploadContent}>
            <div className={styles.uploadIcon}>📷</div>
            <p className={styles.uploadText}>
              Kéo & thả hình ảnh hoặc <span>chọn tệp</span>
            </p>
            <p className={styles.uploadHint}>
              Hỗ trợ: JPG, PNG, GIF, WebP (Tối đa {maxSize}MB)
            </p>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
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