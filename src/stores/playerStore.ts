/**
 * Player Store — owns player avatar, camera, and input state.
 */
import { create } from 'zustand';
import type { ShapeType } from './worldStore';

export type CameraMode = 'first' | 'third';

export interface AvatarData {
  color: string;
  style: string;
  name: string;
  clothingColor?: string;
  hairColor?: string;
}

export interface DraggedCubeData {
  id: string;
  pos: [number, number, number];
  texture: string;
  shape: ShapeType;
  scale: number;
  rotation?: [number, number, number];
  color?: string;
  originalPos: [number, number, number];
}

interface PlayerState {
  playerAvatar: AvatarData;
  cameraMode: CameraMode;
  cameraDistance: number;
  isInWater: boolean;
  draggedCube: DraggedCubeData | null;

  setPlayerAvatar: (avatar: Partial<AvatarData>) => void;
  setCameraMode: (mode: CameraMode) => void;
  setCameraDistance: (distance: number) => void;
  setInWater: (inWater: boolean) => void;
  setDraggedCube: (cube: DraggedCubeData | null) => void;
  teleportPlayer: (pos: [number, number, number]) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playerAvatar: {
    color: '#ffcc00',
    style: 'casual',
    name: 'Player',
    clothingColor: '#3b82f6',
    hairColor: '#4b2c20',
  },
  cameraMode: 'first',
  cameraDistance: 5,
  isInWater: false,
  draggedCube: null,

  setPlayerAvatar: (avatar) => set((state) => ({
    playerAvatar: { ...state.playerAvatar, ...avatar },
  })),
  setCameraMode: (cameraMode) => set((state) => state.cameraMode === cameraMode ? state : { cameraMode }),
  setCameraDistance: (cameraDistance) => set((state) => state.cameraDistance === cameraDistance ? state : { cameraDistance }),
  setInWater: (isInWater) => set((state) => state.isInWater === isInWater ? state : { isInWater }),
  setDraggedCube: (draggedCube) => set({ draggedCube }),
  teleportPlayer: (pos) => {
    window.dispatchEvent(new CustomEvent('teleport-player', { detail: pos }));
  },
}));
