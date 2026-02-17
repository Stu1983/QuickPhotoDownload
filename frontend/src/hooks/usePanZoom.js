import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Pan & zoom hook for image viewing.
 *
 * Supports:
 *  - Mouse wheel zoom (toward cursor)
 *  - Mouse drag to pan (when zoomed in)
 *  - Pinch-to-zoom on touch devices
 *  - Single-finger pan on touch (when zoomed in)
 *  - Double-tap to toggle zoom on touch
 *
 * Returns:
 *  - transform  { scale, x, y }
 *  - isZoomed   true when scale > 1
 *  - bind        props to spread onto the container element
 *  - reset()    resets to scale 1
 */
export default function usePanZoom() {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const containerRef = useRef(null);

  // Refs for gesture tracking (no re-renders needed)
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const lastPinchDist = useRef(null);
  const pinchMid = useRef(null);
  const lastTap = useRef(0);
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const MIN_SCALE = 1;
  const MAX_SCALE = 10;

  const clampTransform = useCallback((s, x, y) => {
    const scale = Math.min(Math.max(s, MIN_SCALE), MAX_SCALE);
    // If at 1x, snap to origin
    if (scale <= 1) return { scale: 1, x: 0, y: 0 };
    return { scale, x, y };
  }, []);

  const reset = useCallback(() => {
    setTransform({ scale: 1, x: 0, y: 0 });
  }, []);

  // ── Mouse wheel zoom (toward cursor) ─────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setTransform(prev => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(prev.scale * factor, MIN_SCALE), MAX_SCALE);

      // Cursor position relative to container centre
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      // Keep the point under the cursor fixed
      const ratio = newScale / prev.scale;
      const nx = cx - (cx - prev.x) * ratio;
      const ny = cy - (cy - prev.y) * ratio;

      return clampTransform(newScale, nx, ny);
    });
  }, [clampTransform]);

  // ── Mouse drag to pan ─────────────────────────────────────────
  const handlePointerDown = useCallback((e) => {
    // Only left mouse button for drag
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Only handle mouse drag here; touch is handled separately
    if (e.pointerType !== 'mouse') return;
    if (transformRef.current.scale <= 1) return;

    dragging.current = true;
    dragStart.current = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || e.pointerType !== 'mouse') return;
    setTransform(prev => clampTransform(prev.scale, e.clientX - dragStart.current.x, e.clientY - dragStart.current.y));
  }, [clampTransform]);

  const handlePointerUp = useCallback((e) => {
    if (e.pointerType !== 'mouse') return;
    dragging.current = false;
  }, []);

  // ── Touch: pinch zoom + pan + double-tap ──────────────────────
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      // Start pinch
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist.current = Math.hypot(dx, dy);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        pinchMid.current = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left - rect.width / 2,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top - rect.height / 2,
        };
      }
    } else if (e.touches.length === 1) {
      // Double-tap detection
      const now = Date.now();
      if (now - lastTap.current < 300) {
        // Toggle zoom
        e.preventDefault();
        setTransform(prev => {
          if (prev.scale > 1) return { scale: 1, x: 0, y: 0 };
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return { scale: 3, x: 0, y: 0 };
          const cx = e.touches[0].clientX - rect.left - rect.width / 2;
          const cy = e.touches[0].clientY - rect.top - rect.height / 2;
          // Zoom to 3x centred on tap point
          const ns = 3;
          return clampTransform(ns, cx - cx * ns, cy - cy * ns);
        });
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;

      // Start single-finger pan (only when zoomed)
      if (transformRef.current.scale > 1) {
        dragging.current = true;
        dragStart.current = {
          x: e.touches[0].clientX - transformRef.current.x,
          y: e.touches[0].clientY - transformRef.current.y,
        };
      }
    }
  }, [clampTransform]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (lastPinchDist.current !== null) {
        const factor = dist / lastPinchDist.current;
        setTransform(prev => {
          const newScale = Math.min(Math.max(prev.scale * factor, MIN_SCALE), MAX_SCALE);
          const mid = pinchMid.current || { x: 0, y: 0 };
          const ratio = newScale / prev.scale;
          const nx = mid.x - (mid.x - prev.x) * ratio;
          const ny = mid.y - (mid.y - prev.y) * ratio;
          return clampTransform(newScale, nx, ny);
        });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && dragging.current) {
      // Single-finger pan when zoomed
      e.preventDefault();
      setTransform(prev =>
        clampTransform(prev.scale, e.touches[0].clientX - dragStart.current.x, e.touches[0].clientY - dragStart.current.y)
      );
    }
  }, [clampTransform]);

  const handleTouchEnd = useCallback(() => {
    dragging.current = false;
    lastPinchDist.current = null;
    pinchMid.current = null;
  }, []);

  // Attach wheel with { passive: false } so we can preventDefault
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const isZoomed = transform.scale > 1;

  // Props to spread onto the container
  const bind = {
    ref: containerRef,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };

  const imageStyle = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
    transformOrigin: 'center center',
    transition: dragging.current ? 'none' : 'transform 0.1s ease-out',
    cursor: isZoomed ? 'grab' : 'default',
  };

  return { transform, isZoomed, bind, imageStyle, reset };
}
