import { useEffect, useRef, useState, useCallback } from 'react';

export const MIN_DOCUMENT_ZOOM = 60;
export const MAX_DOCUMENT_ZOOM = 250;

export function clampDocumentZoom(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(MAX_DOCUMENT_ZOOM, Math.max(MIN_DOCUMENT_ZOOM, Math.round(value)));
}

export function computePinchZoom(
  startZoom: number,
  startDistance: number,
  currentDistance: number
): { targetZoom: number; gestureScale: number } {
  const safeStartZoom = clampDocumentZoom(startZoom);
  if (startDistance <= 0 || currentDistance <= 0) {
    return { targetZoom: safeStartZoom, gestureScale: 1 };
  }
  const ratio = currentDistance / startDistance;
  const targetZoom = clampDocumentZoom(safeStartZoom * ratio);
  const gestureScale = targetZoom / safeStartZoom;
  return { targetZoom, gestureScale };
}

function getTouchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.hypot(dx, dy);
}

interface UsePinchZoomOptions {
  targetRef: React.RefObject<HTMLElement | null>;
  zoom: number;
  onCommitZoom: (nextZoom: number) => void;
  enabled?: boolean;
}

export function usePinchZoom({
  targetRef,
  zoom,
  onCommitZoom,
  enabled = true,
}: UsePinchZoomOptions) {
  const [isPinching, setIsPinching] = useState(false);
  const [gestureScale, setGestureScale] = useState(1);
  const [liveZoom, setLiveZoom] = useState(zoom);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const commitRef = useRef(onCommitZoom);
  commitRef.current = onCommitZoom;

  const pinchingRef = useRef(false);
  const startDistRef = useRef(0);
  const startZoomRef = useRef(zoom);
  const finalZoomRef = useRef(zoom);

  useEffect(() => {
    if (!pinchingRef.current) {
      setLiveZoom(zoom);
    }
  }, [zoom]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || !enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        if (dist > 0) {
          pinchingRef.current = true;
          startDistRef.current = dist;
          startZoomRef.current = zoomRef.current;
          finalZoomRef.current = zoomRef.current;
          setIsPinching(true);
          setGestureScale(1);
          setLiveZoom(zoomRef.current);
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pinchingRef.current || e.touches.length !== 2) return;
      // Prevent browser viewport pinch so only the document page zooms
      e.preventDefault();
      const currentDist = getTouchDistance(e.touches[0], e.touches[1]);
      const { targetZoom, gestureScale: nextScale } = computePinchZoom(
        startZoomRef.current,
        startDistRef.current,
        currentDist
      );
      finalZoomRef.current = targetZoom;
      setGestureScale(nextScale);
      setLiveZoom(targetZoom);
    };

    const finishPinch = () => {
      if (!pinchingRef.current) return;
      pinchingRef.current = false;
      const committed = clampDocumentZoom(finalZoomRef.current);
      setIsPinching(false);
      setGestureScale(1);
      setLiveZoom(committed);
      if (committed !== zoomRef.current) {
        commitRef.current(committed);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        finishPinch();
      }
    };

    const onTouchCancel = () => {
      finishPinch();
    };

    // Trackpad pinch-zoom fallback (desktop browsers emit ctrlKey wheel events)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 10 : -10;
      const next = clampDocumentZoom(zoomRef.current + delta);
      if (next !== zoomRef.current) {
        commitRef.current(next);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('wheel', onWheel);
    };
  }, [targetRef, enabled]);

  const handleDoubleTapZoom = useCallback(() => {
    const next = zoomRef.current > 110 ? 100 : 150;
    commitRef.current(next);
  }, []);

  return {
    isPinching,
    gestureScale,
    displayZoom: isPinching ? liveZoom : zoom,
    handleDoubleTapZoom,
  };
}
