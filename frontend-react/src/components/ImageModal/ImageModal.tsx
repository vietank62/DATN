import React from 'react';

interface ImageModalProps {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  description?: string;
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, imageUrl, title, description, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const styles = {
    backdrop: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      zIndex: 1000,
    },
    modal: {
      position: 'relative' as const,
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      maxWidth: '90%',
      maxHeight: '90vh',
      overflow: 'hidden' as const,
      display: 'flex' as const,
      flexDirection: 'column' as const,
    },
    closeBtn: {
      position: 'absolute' as const,
      top: '15px',
      right: '15px',
      background: 'rgba(0, 0, 0, 0.6)',
      color: 'white',
      border: 'none',
      borderRadius: '50%',
      width: '40px',
      height: '40px',
      fontSize: '24px',
      cursor: 'pointer' as const,
      zIndex: 10,
      transition: 'background-color 0.2s',
    },
    content: {
      display: 'flex' as const,
      flexDirection: 'column' as const,
      alignItems: 'center' as const,
      padding: '20px',
      gap: '20px',
      overflowY: 'auto' as const,
    },
    image: {
      maxWidth: '100%',
      maxHeight: '60vh',
      objectFit: 'contain' as const,
      borderRadius: '8px',
    },
    info: {
      textAlign: 'center' as const,
      padding: '0 20px',
      marginBottom: '10px',
    },
    title: {
      fontSize: '24px',
      fontWeight: 600,
      margin: '0 0 10px 0',
      color: '#333',
    },
    description: {
      fontSize: '14px',
      color: '#666',
      margin: 0,
      lineHeight: '1.5',
    },
  };

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={styles.modal}>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
        <div style={styles.content}>
          <img src={imageUrl} alt={title || 'Image'} style={styles.image} />
          {(title || description) && (
            <div style={styles.info}>
              {title && <h2 style={styles.title}>{title}</h2>}
              {description && <p style={styles.description}>{description}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
