import { useState, useCallback } from 'react';

export default function usePanZoom() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    setTransform(prev => {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(prev.scale * delta, 0.5), 10);
      return { ...prev, scale: newScale };
    });
  }, []);

  const reset = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  return { transform, handleWheel, reset, setTransform };
}
