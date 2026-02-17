import { useEffect } from 'react';

export default function usePreloader(photos, currentIndex) {
  useEffect(() => {
    if (!photos.length) return;

    const indices = [
      currentIndex - 2,
      currentIndex - 1,
      currentIndex + 1,
      currentIndex + 2,
    ].filter(i => i >= 0 && i < photos.length);

    indices.forEach(i => {
      const photo = photos[i];
      if (photo?.preview_url) {
        const img = new Image();
        img.src = photo.preview_url;
      }
    });
  }, [photos, currentIndex]);
}
