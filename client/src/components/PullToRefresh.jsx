import { useEffect, useRef, useState } from 'react';

/**
 * Pull-to-refresh on phones: drag down from the top of the page to reload.
 * Desktop browsers already have their own refresh, so this only activates
 * on touch devices.
 */
export default function PullToRefresh() {
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);

  const startY = useRef(null);
  const pullingRef = useRef(false);
  const distanceRef = useRef(0);
  const threshold = 80;

  useEffect(() => {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return undefined;

    const onTouchStart = (event) => {
      if (window.scrollY > 0) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0].clientY;
    };

    const onTouchMove = (event) => {
      if (startY.current === null) return;
      const dy = event.touches[0].clientY - startY.current;
      if (dy <= 0) {
        if (pullingRef.current) {
          pullingRef.current = false;
          setPulling(false);
          setDistance(0);
          distanceRef.current = 0;
        }
        return;
      }
      pullingRef.current = true;
      const clamped = Math.min(dy, threshold * 1.5);
      distanceRef.current = clamped;
      setPulling(true);
      setDistance(clamped);
      if (dy > 10) event.preventDefault();
    };

    const onTouchEnd = () => {
      if (startY.current === null) return;
      if (distanceRef.current >= threshold) {
        window.location.reload();
      } else {
        pullingRef.current = false;
        setPulling(false);
        setDistance(0);
        distanceRef.current = 0;
      }
      startY.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [threshold]);

  if (!pulling) return null;

  const progress = Math.min(1, distance / threshold);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 14,
        zIndex: 9999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          color: '#3b2410',
          transform: `rotate(${distance * 4}deg) scale(${0.8 + 0.2 * progress})`,
          opacity: progress,
        }}
      >
        ↻
      </div>
    </div>
  );
}
