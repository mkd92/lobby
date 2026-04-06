import { useState, useEffect, useCallback } from 'react';

const INPUT_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isTypingTarget(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return INPUT_TAGS.has(el.tagName) || el.isContentEditable;
}

export function useListKeyNav<T extends { id: string }>(
  items: T[],
  onActivate: (item: T) => void,
  active = true,
): { selectedIndex: number; selectedId: string | null; clearSelection: () => void } {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const clearSelection = useCallback(() => setSelectedIndex(-1), []);

  // Reset selection when items change (e.g. filter changed)
  useEffect(() => {
    setSelectedIndex(-1);
  }, [items]);

  useEffect(() => {
    if (!active) return;

    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget()) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev <= 0 ? 0 : prev - 1));
      } else if (e.key === 'Enter') {
        setSelectedIndex(prev => {
          if (prev >= 0 && prev < items.length) {
            onActivate(items[prev]);
          }
          return prev;
        });
      } else if (e.key === 'Escape') {
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [active, items, onActivate]);

  return {
    selectedIndex,
    selectedId: selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex].id : null,
    clearSelection,
  };
}
