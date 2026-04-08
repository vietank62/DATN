import React, { useState, useRef } from 'react';
import { uploadImage } from '../../services/api';
import styles from './ImageUpload.module.css';

interface ImageUploadProps {
  onImageUpload: (url: string) => void;
  currentImageUrl?: string;
  label?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageUpload, currentImageUrl, label = 'Tải lên hình ảnh' }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setUploading(true);

    try {
      // Show preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload file
      const result = await uploadImage(file);
      onImageUpload(result.url);
    } catch (err: any) {
      setError(err.message || 'Upload thất bại');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.previewArea}>
        {preview ? (
          <div className={styles.preview}>
            <img src={preview} alt="Preview" />
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              ✕ Xóa
            </button>
          </div>
        ) : (
          <div className={styles.placeholder}>
            <div className={styles.icon}>📷</div>
            <p>Chưa có hình ảnh</p>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        disabled={uploading}
        style={{ display: 'none' }}
      />

      <button
        type="button"
        className={styles.uploadBtn}
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? '⏳ Đang tải...' : `📁 ${label}`}
      </button>

      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
};

export default ImageUpload;
