import React, { useEffect, useRef, useCallback } from 'react';
import PhotoCard from './PhotoCard';

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '4px',
    padding: '4px',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: 'var(--text-secondary)',
  },
  empty: {
    textAlign: 'center',
    padding: '80px 20px',
    color: 'var(--text-secondary)',
    fontSize: '1.1rem',
  },
  sentinel: {
    height: '1px',
  },
};

export default function PhotoGrid({ photos, loading, hasMore, loadMore, onPhotoClick }) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: '400px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  if (!loading && photos.length === 0) {
    return <div style={styles.empty}>No photos found</div>;
  }

  return (
    <>
      <div style={styles.grid}>
        {photos.map((photo, index) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            onClick={() => onPhotoClick(index)}
          />
        ))}
      </div>
      {loading && <div style={styles.loading}>Loading...</div>}
      {hasMore && <div ref={sentinelRef} style={styles.sentinel} />}
    </>
  );
}
