import { useState, useEffect } from 'react';

export function useCommandPalette(): {
  paletteOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
} {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return {
    paletteOpen,
    openPalette:  () => setPaletteOpen(true),
    closePalette: () => setPaletteOpen(false),
  };
}
