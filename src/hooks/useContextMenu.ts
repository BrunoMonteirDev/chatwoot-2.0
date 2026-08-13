import React, { useState, useCallback } from 'react';
import { ContextMenuItem } from '../components/ContextMenu';

export interface ContextMenuState {
  x: number;
  y: number;
  isOpen: boolean;
  title?: string;
  items: ContextMenuItem[];
}

export function useContextMenu() {
  const [menuState, setMenuState] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    isOpen: false,
    items: [],
  });

  const openContextMenu = useCallback(
    (e: React.MouseEvent, items: ContextMenuItem[], title?: string) => {
      e.preventDefault();
      e.stopPropagation();
      setMenuState({
        x: e.clientX,
        y: e.clientY,
        isOpen: true,
        title,
        items,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setMenuState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  return {
    menuState,
    openContextMenu,
    closeContextMenu,
  };
}
