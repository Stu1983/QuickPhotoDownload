import React, { useState, useCallback } from 'react';
import PhotoGrid from '../components/PhotoGrid';
import PhotoViewer from '../components/PhotoViewer';
import FlagFilter from '../components/FlagFilter';
import DownloadModal from '../components/DownloadModal';
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
  downloadBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    background: 'var(--accent)',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginLeft: 'auto',
  },
  clearBtn: {
    padding: '6px 14px',
    borderRadius: '6px',
    background: '#ef4444',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
};

export default function FlaggedPage() {
  const [flagFilter, setFlagFilter] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);
  const [showDownload, setShowDownload] = useState(false);

  // Only show flagged photos - if no specific flag selected, we fetch without a flag filter
  // but the page is intended to show flagged photos only
  const filters = {};
  if (flagFilter) {
    filters.flag = flagFilter;
  }

  const { photos, loading, hasMore, loadMore, refresh, setPhotos } = usePhotos(filters);
  const { toggleFlag } = useFlags(setPhotos);

  // Filter to only flagged photos client-side when no specific flag filter
  const flaggedPhotos = flagFilter ? photos : photos.filter(p => p.flags.length > 0);

  const handleDownload = async (size) => {
    const body = { size };
    if (flagFilter) {
      body.flag = flagFilter;
    } else {
      body.photo_ids = flaggedPhotos.map(p => p.id);
    }

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photos-flagged${flagFilter ? '-' + flagFilter : ''}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <>
      <div style={styles.filters}>
        <FlagFilter value={flagFilter} onChange={setFlagFilter} />
        {flaggedPhotos.length > 0 && (
          <button style={styles.downloadBtn} onClick={() => setShowDownload(true)}>
            Download All ({flaggedPhotos.length})
          </button>
        )}
      </div>

      <PhotoGrid
        photos={flaggedPhotos}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        onPhotoClick={(index) => setViewerIndex(index)}
      />

      {viewerIndex !== null && (
        <PhotoViewer
          photos={flaggedPhotos}
          initialIndex={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onToggleFlag={toggleFlag}
          compareSelection={[]}
          onToggleCompare={() => {}}
        />
      )}

      {showDownload && (
        <DownloadModal
          count={flaggedPhotos.length}
          onDownload={handleDownload}
          onClose={() => setShowDownload(false)}
        />
      )}
    </>
  );
}
