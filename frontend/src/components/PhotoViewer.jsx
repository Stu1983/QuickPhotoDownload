import React, { useState, useEffect, useCallback, useRef } from 'react';
import FlagBar from './FlagBar';
import usePreloader from '../hooks/usePreloader';

function formatDate(isoStr) {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${min}:${ss}`;
  } catch {
    return null;
  }
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.95)',
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    color: '#fff',
    fontSize: '0.9rem',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '4px 8px',
  },
  imageContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    touchAction: 'none',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  navBtn: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.5)',
    border: 'none',
    color: '#fff',
    fontSize: '2rem',
    padding: '16px 12px',
    cursor: 'pointer',
    zIndex: 10,
    borderRadius: '4px',
  },
  footer: {
    padding: '8px',
  },
  actions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    padding: '8px',
  },
  actionBtn: {
    padding: '6px 16px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  compareActive: {
    background: 'var(--accent)',
    borderColor: 'var(--accent)',
  },
  dateStamp: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    background: 'rgba(0,0,0,0.6)',
    color: '#ffa500',
    fontSize: '0.9rem',
    padding: '4px 10px',
    borderRadius: '4px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    zIndex: 10,
    pointerEvents: 'none',
  },
};

export default function PhotoViewer({
  photos,
  initialIndex,
  onClose,
  onToggleFlag,
  compareSelection,
  onToggleCompare,
}) {
  const [index, setIndex] = useState(initialIndex);
  const touchStartX = useRef(null);

  const photo = photos[index];
  usePreloader(photos, index);

  const goNext = useCallback(() => {
    setIndex(i => Math.min(i + 1, photos.length - 1));
  }, [photos.length]);

  const goPrev = useCallback(() => {
    setIndex(i => Math.max(i - 1, 0));
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goNext, goPrev, onClose]);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goPrev();
      else goNext();
    }
    touchStartX.current = null;
  };

  if (!photo) return null;

  const isInCompare = compareSelection?.includes(photo.id);
  const dateText = formatDate(photo.exif_date);

  return (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        <span>{photo.filename} ({index + 1}/{photos.length})</span>
        <a
          href={`/api/photos/${photo.id}/original`}
          download={photo.filename}
          style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}
        >
          Download
        </a>
      </div>

      <div
        style={styles.imageContainer}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {index > 0 && (
          <button style={{ ...styles.navBtn, left: '8px' }} onClick={goPrev}>
            &#8249;
          </button>
        )}
        <img
          src={photo.preview_url}
          alt={photo.filename}
          style={styles.image}
        />
        {dateText && (
          <div style={styles.dateStamp}>{dateText}</div>
        )}
        {index < photos.length - 1 && (
          <button style={{ ...styles.navBtn, right: '8px' }} onClick={goNext}>
            &#8250;
          </button>
        )}
      </div>

      <div style={styles.footer}>
        <div style={styles.actions}>
          <button
            style={{
              ...styles.actionBtn,
              ...(isInCompare ? styles.compareActive : {}),
            }}
            onClick={() => onToggleCompare(photo.id)}
          >
            {isInCompare ? 'Remove from Compare' : 'Compare'}
          </button>
        </div>
        <FlagBar
          activeFlags={photo.flags}
          onToggle={(colour) => onToggleFlag(photo.id, colour, photo.flags)}
        />
      </div>
    </div>
  );
}
