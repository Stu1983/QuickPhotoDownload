import React, { useState, useCallback, useEffect } from 'react';
import PhotoGrid from '../components/PhotoGrid';
import PhotoViewer from '../components/PhotoViewer';
import CompareView from '../components/CompareView';
import DayFilter from '../components/DayFilter';
import FlagFilter from '../components/FlagFilter';
import usePhotos from '../hooks/usePhotos';
import useFlags from '../hooks/useFlags';

const styles = {
  filters: {
    display: 'flex',
    gap: '10px',
    padding: '12px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  compareInfo: {
    position: 'fixed',
    bottom: '20px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--accent)',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '24px',
    zIndex: 50,
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    boxShadow: '0 4px 20px var(--shadow)',
    fontSize: '0.9rem',
  },
  compareBtn: {
    padding: '4px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.3)',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};

export default function HomePage() {
  const [dayFilter, setDayFilter] = useState(null);
  const [flagFilter, setFlagFilter] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [compareIds, setCompareIds] = useState([]);

  const { photos, loading, hasMore, loadMore, refresh, setPhotos } = usePhotos({
    day: dayFilter,
    flag: flagFilter,
  });
  const { toggleFlag } = useFlags(setPhotos);

  const handleToggleCompare = useCallback((id) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }, []);

  // Auto-close viewer and show compare when second photo is selected
  useEffect(() => {
    if (compareIds.length === 2 && viewerIndex !== null) {
      setViewerIndex(null);
    }
  }, [compareIds.length, viewerIndex]);

  return (
    <>
      <div style={styles.filters}>
        <DayFilter value={dayFilter} onChange={setDayFilter} />
        <FlagFilter value={flagFilter} onChange={setFlagFilter} />
      </div>

      <PhotoGrid
        photos={photos}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        onPhotoClick={(index) => setViewerIndex(index)}
      />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={photos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onToggleFlag={toggleFlag}
          compareSelection={compareIds}
          onToggleCompare={handleToggleCompare}
        />
      )}

      {compareIds.length === 2 && viewerIndex === null && (
        <CompareView
          photos={photos}
          photoIds={compareIds}
          onClose={() => setCompareIds([])}
          onToggleFlag={toggleFlag}
        />
      )}

      {compareIds.length > 0 && compareIds.length < 2 && viewerIndex === null && (
        <div style={styles.compareInfo}>
          <span>{compareIds.length}/2 selected for compare</span>
          <button style={styles.compareBtn} onClick={() => setCompareIds([])}>Clear</button>
        </div>
      )}
    </>
  );
}
