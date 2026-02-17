import { useCallback } from 'react';

export default function useFlags(setPhotos) {
  const toggleFlag = useCallback(async (photoId, colour, currentFlags) => {
    const hasFlag = currentFlags.includes(colour);

    try {
      if (hasFlag) {
        await fetch(`/api/photos/${photoId}/flags/${colour}`, { method: 'DELETE' });
      } else {
        await fetch(`/api/photos/${photoId}/flags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colour }),
        });
      }

      // Update local state
      if (setPhotos) {
        setPhotos(prev =>
          prev.map(p => {
            if (p.id !== photoId) return p;
            return {
              ...p,
              flags: hasFlag
                ? p.flags.filter(f => f !== colour)
                : [...p.flags, colour],
            };
          })
        );
      }

      return !hasFlag;
    } catch (err) {
      console.error('Failed to toggle flag:', err);
      return hasFlag;
    }
  }, [setPhotos]);

  return { toggleFlag };
}
