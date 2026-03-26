/**
 * UI Store — owns UI overlay state (map, help, customizer, etc.)
 */
import { create } from 'zustand';

interface UIState {
  showMap: boolean;
  showHelp: boolean;
  showCustomizer: boolean;
  activeNPC: string | null;
  isUIHovered: boolean;

  setShowMap: (show: boolean) => void;
  setShowHelp: (show: boolean) => void;
  setShowCustomizer: (show: boolean) => void;
  setActiveNPC: (npcId: string | null) => void;
  setIsUIHovered: (hovered: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  showMap: false,
  showHelp: true,
  showCustomizer: false,
  activeNPC: null,
  isUIHovered: false,

  setShowMap: (showMap) => set({ showMap }),
  setShowHelp: (showHelp) => set({ showHelp }),
  setShowCustomizer: (showCustomizer) => set({ showCustomizer }),
  setActiveNPC: (activeNPC) => set({ activeNPC }),
  setIsUIHovered: (isUIHovered) => set({ isUIHovered }),
}));
