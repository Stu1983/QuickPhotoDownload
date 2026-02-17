import React, { useState, useRef, useCallback, useEffect } from 'react';
import FlagBar from './FlagBar';
import usePanZoom from '../hooks/usePanZoom';

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
    gap: '10px',
    flexWrap: 'wrap',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#fff',
    fontSize: '1.5rem',
    cursor: 'pointer',
  },
  headerBtns: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  modeBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  modeBtnActive: {
    padding: '5px 10px',
    borderRadius: '6px',
    background: 'var(--accent)',
    border: '1px solid var(--accent)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },
  swapBtn: {
    padding: '5px 10px',
    borderRadius: '6px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
  },

  /* Side-by-side styles */
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
    position: 'relative',
    touchAction: 'none',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    flex: 1,
    userSelect: 'none',
    WebkitUserDrag: 'none',
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

  /* Overlay mode styles */
  overlayContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    touchAction: 'none',
  },
  overlayImgBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  overlayImgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
  },
  /* Wide invisible hit area around the slider line */
  sliderGrabZone: {
    position: 'absolute',
    top: 0,
    width: '40px',
    height: '100%',
    cursor: 'ew-resize',
    zIndex: 5,
    touchAction: 'none',
  },
  sliderLine: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    width: '3px',
    height: '100%',
    background: '#fff',
    boxShadow: '0 0 6px rgba(0,0,0,0.8)',
    pointerEvents: 'none',
  },
  sliderHandle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    color: '#333',
    boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
    userSelect: 'none',
    pointerEvents: 'none',
  },
  overlayLabel: {
    position: 'absolute',
    top: '10px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '3px',
    pointerEvents: 'none',
    zIndex: 6,
    maxWidth: '40%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  overlayDateStamp: {
    position: 'absolute',
    bottom: '10px',
    background: 'rgba(0,0,0,0.6)',
    color: '#ffa500',
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '3px',
    pointerEvents: 'none',
    zIndex: 6,
    whiteSpace: 'nowrap',
  },

  /* Navigation */
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
  navHint: {
    color: 'var(--text-secondary)',
    fontSize: '0.75rem',
    textAlign: 'center',
    padding: '4px 0',
  },
  zoomIndicator: {
    position: 'absolute',
    top: '10px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '0.75rem',
    padding: '3px 10px',
    borderRadius: '12px',
    pointerEvents: 'none',
    zIndex: 10,
  },

  /* Footer */
  footer: {
    display: 'flex',
    justifyContent: 'space-around',
  },
  flagSection: {
    flex: 1,
  },
};

export default function CompareView({ photos, photoIds, onClose, onToggleFlag }) {
  // Anchor (left) stays fixed; right photo can be navigated through the list
  const [anchorId, setAnchorId] = useState(photoIds[0]);
  const [rightIdx, setRightIdx] = useState(() => {
    const idx = photos.findIndex(p => p.id === photoIds[1]);
    return idx >= 0 ? idx : 0;
  });
  const [mode, setMode] = useState('side'); // 'side' or 'overlay'
  const [sliderPos, setSliderPos] = useState(0.5); // 0..1
  const sliderContainerRef = useRef(null);
  const sliderDragging = useRef(false);

  // Three zoom instances (always called — React hook rules)
  const leftZoom = usePanZoom();
  const rightZoom = usePanZoom();
  const overlayZoom = usePanZoom();

  const leftPhoto = photos.find(p => p.id === anchorId);
  const rightPhoto = photos[rightIdx];

  const goNext = useCallback(() => {
    setRightIdx(i => {
      let next = i + 1;
      while (next < photos.length && photos[next].id === anchorId) next++;
      return next < photos.length ? next : i;
    });
  }, [photos, anchorId]);

  const goPrev = useCallback(() => {
    setRightIdx(i => {
      let prev = i - 1;
      while (prev >= 0 && photos[prev].id === anchorId) prev--;
      return prev >= 0 ? prev : i;
    });
  }, [photos, anchorId]);

  const swap = useCallback(() => {
    const currentRightPhoto = photos[rightIdx];
    if (!currentRightPhoto) return;
    const oldAnchorIdx = photos.findIndex(p => p.id === anchorId);
    setAnchorId(currentRightPhoto.id);
    setRightIdx(oldAnchorIdx >= 0 ? oldAnchorIdx : 0);
  }, [photos, rightIdx, anchorId]);

  // Reset all zoom when mode changes or photos change
  useEffect(() => {
    leftZoom.reset();
    rightZoom.reset();
    overlayZoom.reset();
  }, [mode, anchorId, rightIdx]);

  // ── Slider drag (overlay mode) — only on the grab zone ──────
  const onSliderPointerDown = useCallback((e) => {
    e.stopPropagation();
    sliderDragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onSliderPointerMove = useCallback((e) => {
    if (!sliderDragging.current) return;
    // Use the overlay container for position reference
    const rect = sliderContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setSliderPos(x / rect.width);
  }, []);

  const onSliderPointerUp = useCallback(() => {
    sliderDragging.current = false;
  }, []);

  // ── Keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!leftPhoto || !rightPhoto) return null;

  // Check if prev/next are available (skipping anchor)
  let hasPrev = false;
  for (let i = rightIdx - 1; i >= 0; i--) {
    if (photos[i].id !== anchorId) { hasPrev = true; break; }
  }
  let hasNext = false;
  for (let i = rightIdx + 1; i < photos.length; i++) {
    if (photos[i].id !== anchorId) { hasNext = true; break; }
  }

  const leftDate = formatDate(leftPhoto.exif_date);
  const rightDate = formatDate(rightPhoto.exif_date);

  const anyZoomed = mode === 'side'
    ? (leftZoom.isZoomed || rightZoom.isZoomed)
    : overlayZoom.isZoomed;

  return (
    <div style={styles.overlay}>
      <div style={styles.header}>
        <button style={styles.closeBtn} onClick={onClose}>&times;</button>
        <span>Compare</span>
        <div style={styles.headerBtns}>
          <button
            style={mode === 'side' ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => setMode('side')}
          >
            Side by Side
          </button>
          <button
            style={mode === 'overlay' ? styles.modeBtnActive : styles.modeBtn}
            onClick={() => setMode('overlay')}
          >
            Overlay
          </button>
          <button style={styles.swapBtn} onClick={swap}>Swap</button>
        </div>
      </div>

      {mode === 'side' ? (
        <div style={styles.container}>
          {/* Left side (anchor) */}
          <div style={styles.side} {...leftZoom.bind}>
            <img
              src={leftPhoto.preview_url}
              alt={leftPhoto.filename}
              style={{ ...styles.image, ...leftZoom.imageStyle }}
              draggable={false}
            />
            {leftZoom.isZoomed && (
              <div style={styles.zoomIndicator}>
                {Math.round(leftZoom.transform.scale * 100)}%
              </div>
            )}
            <div style={styles.label}>{leftPhoto.filename} (anchor)</div>
          </div>
          <div style={styles.divider} />
          {/* Right side (navigable) */}
          <div style={styles.side} {...rightZoom.bind}>
            {hasPrev && !rightZoom.isZoomed && (
              <button style={{ ...styles.navBtn, left: '8px' }} onClick={goPrev}>&#8249;</button>
            )}
            <img
              src={rightPhoto.preview_url}
              alt={rightPhoto.filename}
              style={{ ...styles.image, ...rightZoom.imageStyle }}
              draggable={false}
            />
            {rightZoom.isZoomed && (
              <div style={styles.zoomIndicator}>
                {Math.round(rightZoom.transform.scale * 100)}%
              </div>
            )}
            {hasNext && !rightZoom.isZoomed && (
              <button style={{ ...styles.navBtn, right: '8px' }} onClick={goNext}>&#8250;</button>
            )}
            <div style={styles.label}>{rightPhoto.filename}</div>
          </div>
        </div>
      ) : (
        <div
          ref={(el) => {
            sliderContainerRef.current = el;
            overlayZoom.bind.ref.current = el;
          }}
          style={styles.overlayContainer}
          onPointerDown={overlayZoom.bind.onPointerDown}
          onPointerMove={overlayZoom.bind.onPointerMove}
          onPointerUp={overlayZoom.bind.onPointerUp}
          onTouchStart={overlayZoom.bind.onTouchStart}
          onTouchMove={overlayZoom.bind.onTouchMove}
          onTouchEnd={overlayZoom.bind.onTouchEnd}
        >
          {/* Right photo as base layer */}
          <img
            src={rightPhoto.preview_url}
            alt={rightPhoto.filename}
            style={{ ...styles.overlayImgBase, ...overlayZoom.imageStyle }}
          />

          {/* Left photo clipped to slider position */}
          <img
            src={leftPhoto.preview_url}
            alt={leftPhoto.filename}
            style={{
              ...styles.overlayImgTop,
              ...overlayZoom.imageStyle,
              clipPath: `inset(0 ${(1 - sliderPos) * 100}% 0 0)`,
            }}
          />

          {/* Slider grab zone — wide invisible area for easy grabbing */}
          <div
            style={{ ...styles.sliderGrabZone, left: `calc(${sliderPos * 100}% - 20px)` }}
            onPointerDown={onSliderPointerDown}
            onPointerMove={onSliderPointerMove}
            onPointerUp={onSliderPointerUp}
          >
            <div style={styles.sliderLine} />
            <div style={styles.sliderHandle}>&#x2B0C;</div>
          </div>

          {/* Labels */}
          {!overlayZoom.isZoomed && (
            <>
              <div style={{ ...styles.overlayLabel, left: '10px' }}>{leftPhoto.filename} (anchor)</div>
              <div style={{ ...styles.overlayLabel, right: '10px' }}>{rightPhoto.filename}</div>
            </>
          )}

          {/* Nav buttons */}
          {hasPrev && !overlayZoom.isZoomed && (
            <button
              style={{ ...styles.navBtn, left: '8px', pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); goPrev(); }}
            >&#8249;</button>
          )}
          {hasNext && !overlayZoom.isZoomed && (
            <button
              style={{ ...styles.navBtn, right: '8px', pointerEvents: 'auto' }}
              onPointerDown={(e) => { e.stopPropagation(); goNext(); }}
            >&#8250;</button>
          )}

          {/* Date stamps */}
          {leftDate && !overlayZoom.isZoomed && (
            <div style={{ ...styles.overlayDateStamp, left: '10px' }}>{leftDate}</div>
          )}
          {rightDate && !overlayZoom.isZoomed && (
            <div style={{ ...styles.overlayDateStamp, right: '10px' }}>{rightDate}</div>
          )}

          {/* Zoom indicator */}
          {overlayZoom.isZoomed && (
            <div style={styles.zoomIndicator}>
              {Math.round(overlayZoom.transform.scale * 100)}% — double-tap or scroll to reset
            </div>
          )}
        </div>
      )}

      <div style={styles.navHint}>
        &#8592; / &#8594; to change comparison photo
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
