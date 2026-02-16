import { useState, useEffect, useCallback } from 'react';

export default function usePhotos(filters = {}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchPhotos = useCallback(async (pageNum = 1, append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', pageNum);
      params.set('per_page', '50');
      if (filters.day) params.set('day', filters.day);
      if (filters.flag) params.set('flag', filters.flag);
      if (filters.folder) params.set('folder', filters.folder);

      const res = await fetch(`/api/photos?${params}`);
      const data = await res.json();

      if (append) {
        setPhotos(prev => [...prev, ...data]);
      } else {
        setPhotos(data);
      }
      setHasMore(data.length === 50);
    } catch (err) {
      console.error('Failed to fetch photos:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.day, filters.flag, filters.folder]);

  useEffect(() => {
    setPage(1);
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPhotos(nextPage, true);
    }
  }, [loading, hasMore, page, fetchPhotos]);

  const refresh = useCallback(() => {
    setPage(1);
    fetchPhotos(1, false);
  }, [fetchPhotos]);

  return { photos, loading, hasMore, loadMore, refresh, setPhotos };
}
