import React, { useState, useRef, useCallback, useEffect } from 'react';
import FlagBar from './FlagBar';

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
  },
  swapBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  container: {
    flex: 1,
    display: 'flex',
    position: 'relative',
    overflow: 'hidden',
  },
  side: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    flex: 1,
  },
  divider: {
    width: '4px',
    background: 'var(--accent)',
    cursor: 'col-resize',
    flexShrink: 0,
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '0.8rem',
    padding: '6px',
    textAlign: 'center',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  flagSection: {
    flex: 1,
  },
};

export default function CompareView({ photos, photoIds, onClose, onToggleFlag }) {
  const [order, setOrder] = useState([0, 1]);
  const leftPhoto = photos.find(p => p.id === photoIds[order[0]]);
  const rightPhoto = photos.find(p => p.id === photoIds[order[1]]);

  const swap = () => setOrder(([a, b]) => [b, a]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!leftPhoto || !rightPhoto) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        <span>Compare</span>
        <button style={styles.swapBtn} onClick={swap}>Swap</button>
      </div>

      <div style={styles.container}>
        <div style={styles.side}>
          <img src={leftPhoto.preview_url} alt={leftPhoto.filename} style={styles.image} />
          <div style={styles.label}>{leftPhoto.filename}</div>
        </div>
        <div style={styles.divider} />
        <div style={styles.side}>
          <img src={rightPhoto.preview_url} alt={rightPhoto.filename} style={styles.image} />
          <div style={styles.label}>{rightPhoto.filename}</div>
        </div>
      </div>

      <div style={styles.footer}>
        <div style={styles.flagSection}>
          <FlagBar
            activeFlags={leftPhoto.flags}
            onToggle={(colour) => onToggleFlag(leftPhoto.id, colour, leftPhoto.flags)}
          />
        </div>
        <div style={styles.flagSection}>
          <FlagBar
            activeFlags={rightPhoto.flags}
            onToggle={(colour) => onToggleFlag(rightPhoto.id, colour, rightPhoto.flags)}
          />
        </div>
      </div>
    </div>
  );
}
