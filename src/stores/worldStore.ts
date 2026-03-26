/**
 * World Store — owns cube/voxel state and world metadata.
 * Replaces the cubes portion of the old monolithic useStore.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type ShapeType = 'cube' | 'sphere' | 'pyramid' | 'cylinder' | 'tree' | 'rock' | 'bush' | 'flower' | 'lamp' | 'fence';

export interface CubeData {
  id: string;
  pos: [number, number, number];
  texture: string;
  shape: ShapeType;
  scale: number;
  rotation?: [number, number, number];
  color?: string;
}

interface WorldState {
  worldId: string;
  cubes: CubeData[];
  worldVersion: number;
  syncing: boolean;

  // Build-tool selections
  texture: string;
  shape: ShapeType;
  scale: number;

  // Actions
  addCube: (x: number, y: number, z: number) => void;
  removeCube: (x: number, y: number, z: number) => void;
  bulkAddCubes: (cubes: Array<{ x: number; y: number; z: number; texture: string; shape?: ShapeType; scale?: number; rotation?: [number, number, number]; color?: string }>) => void;
  setCubes: (cubes: CubeData[]) => void;
  setTexture: (texture: string) => void;
  setShape: (shape: ShapeType) => void;
  setScale: (scale: number) => void;
  resetWorld: () => void;
}

export const useWorldStore = create<WorldState>((set) => ({
  worldId: 'world-default',
  cubes: [],
  worldVersion: 0,
  syncing: false,
  texture: 'grass',
  shape: 'cube',
  scale: 1,

  addCube: (x, y, z) => set((state) => ({
    cubes: [...state.cubes, {
      id: nanoid(),
      pos: [x, y, z],
      texture: state.texture,
      shape: state.shape,
      scale: state.scale,
    }],
  })),

  removeCube: (x, y, z) => set((state) => ({
    cubes: state.cubes.filter((cube) => {
      const [cx, cy, cz] = cube.pos;
      return cx !== x || cy !== y || cz !== z;
    }),
  })),

  bulkAddCubes: (newCubes) => set((state) => {
    const existingPositions = new Set(state.cubes.map(c => c.pos.join(',')));
    const filtered = newCubes
      .filter(nc => !existingPositions.has(`${nc.x},${nc.y},${nc.z}`))
      .map(nc => ({
        id: nanoid(),
        pos: [nc.x, nc.y, nc.z] as [number, number, number],
        texture: nc.texture,
        shape: nc.shape || 'cube' as ShapeType,
        scale: nc.scale || 1,
        rotation: nc.rotation || [0, 0, 0] as [number, number, number],
        color: nc.color || '#ffffff',
      }));
    return { cubes: [...state.cubes, ...filtered] };
  }),

  setCubes: (cubes) => set({ cubes }),

  setTexture: (texture) => set((state) => state.texture === texture ? state : { texture }),
  setShape: (shape) => set((state) => state.shape === shape ? state : { shape }),
  setScale: (scale) => set((state) => state.scale === scale ? state : { scale }),
  resetWorld: () => set({ cubes: [] }),
}));
