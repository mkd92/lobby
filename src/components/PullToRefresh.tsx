import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const THRESHOLD = 72;

const PullToRefresh: React.FC = () => {
  const queryClient = useQueryClient();
  const startYRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(async () => {
    refreshingRef.current = true;
    setRefreshing(true);
    setPullDistance(0);
    await queryClient.invalidateQueries();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      timeoutRef.current = null;
    }, 700);
  }, [queryClient]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || refreshingRef.current) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshingRef.current) return;
      if (window.scrollY > 0) { startYRef.current = null; return; }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) { startYRef.current = null; return; }
      setPullDistance(Math.min(delta * 0.45, THRESHOLD * 1.25));
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) return;
      setPullDistance(prev => {
        if (prev >= THRESHOLD) { trigger(); }
        else { return 0; }
        return prev;
      });
      startYRef.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [trigger]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const visible = pullDistance > 4 || refreshing;

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          paddingTop: refreshing ? '0.75rem' : `${Math.max(pullDistance - 28, 4)}px`,
          transition: refreshing ? 'padding 0.2s' : 'none',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'var(--surface-container-high)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: refreshing ? 1 : progress,
            transform: `scale(${0.55 + progress * 0.45})`,
            transition: refreshing ? 'opacity 0.2s, transform 0.2s' : 'none',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: '1.15rem',
              color: 'var(--primary)',
              display: 'block',
              animation: refreshing ? 'ptr-spin 0.65s linear infinite' : 'none',
              transform: refreshing ? undefined : `rotate(${progress * 240}deg)`,
            }}
          >
            refresh
          </span>
        </div>
      </div>

      <style>{`
        @keyframes ptr-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default PullToRefresh;
