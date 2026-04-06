import { useEffect, useRef } from 'react';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return INPUT_TAGS.has(el.tagName) || el.isContentEditable;
}

const NAV_MAP: Record<string, string> = {
  h: '/hostels',
  p: '/payments',
  c: '/customers',
  l: '/leases',
  t: '/team',
};

export function useGlobalKeyNav(
  navigate: (path: string) => void,
  onHelpToggle: () => void,
  active = true,
): void {
  const pendingGRef = useRef(false);
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (pendingGRef.current) {
        pendingGRef.current = false;
        if (timerRef.current) clearTimeout(timerRef.current);
        const path = NAV_MAP[key];
        if (path) {
          e.preventDefault();
          navigate(path);
        }
        return;
      }

      if (key === '?') {
        e.preventDefault();
        onHelpToggle();
        return;
      }

      if (key === 'g') {
        pendingGRef.current = true;
        timerRef.current = setTimeout(() => {
          pendingGRef.current = false;
        }, 800);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, navigate, onHelpToggle]);
}
