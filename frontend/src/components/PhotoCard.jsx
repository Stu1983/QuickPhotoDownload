import React from 'react';
import { FLAG_COLOURS } from './FlagBar';

const styles = {
  card: {
    position: 'relative',
    aspectRatio: '1',
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'var(--bg-card)',
    borderRadius: '4px',
  },
  img: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transition: 'transform 0.2s',
  },
  flagDots: {
    position: 'absolute',
    top: '4px',
    right: '4px',
    display: 'flex',
    gap: '3px',
    flexWrap: 'wrap',
    maxWidth: '60px',
    justifyContent: 'flex-end',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.3)',
  },
  rawBadge: {
    position: 'absolute',
    bottom: '4px',
    left: '4px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '0.65rem',
    padding: '1px 5px',
    borderRadius: '3px',
    fontWeight: 700,
  },
};

export default function PhotoCard({ photo, onClick }) {
  return (
    <div style={styles.card} onClick={onClick}>
      <img
        src={photo.thumbnail_url}
        alt={photo.filename}
        loading="lazy"
        style={styles.img}
      />
      {photo.flags.length > 0 && (
        <div style={styles.flagDots}>
          {photo.flags.map(colour => {
            const fc = FLAG_COLOURS.find(f => f.id === colour);
            return (
              <div
                key={colour}
                style={{ ...styles.dot, background: fc?.hex || '#888' }}
              />
            );
          })}
        </div>
      )}
      {photo.has_raw_pair && (
        <div style={styles.rawBadge}>RAW</div>
      )}
    </div>
  );
}
