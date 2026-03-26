import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type ShapeType = 'cube' | 'sphere' | 'pyramid' | 'cylinder' | 'tree' | 'rock' | 'bush' | 'flower' | 'lamp' | 'fence';
export type CameraMode = 'first' | 'third';

export interface AvatarData {
  color: string;
  style: string;
  name: string;
  clothingColor?: string;
  hairColor?: string;
}

export interface CubeData {
  id: string;
  pos: [number, number, number];
  texture: string;
  shape: ShapeType;
  scale: number;
  rotation?: [number, number, number];
  color?: string;
}

export interface NPCData {
  id: string;
  pos: [number, number, number];
  name: string;
  color: string;
  style?: string;
  clothingColor?: string;
  hairColor?: string;
  isThinking?: boolean;
  currentTask?: string;
  currentMessage?: string;
  thoughtHistory?: { timestamp: number; thought: string; decision: string }[];
}

export interface DraggedCubeData extends CubeData {
  originalPos: [number, number, number];
}

interface GameState {
  texture: string;
  shape: ShapeType;
  scale: number;
  cubes: CubeData[];
  npcs: NPCData[];
  isInWater: boolean;
  cameraMode: CameraMode;
  cameraDistance: number;
  showMap: boolean;
  playerAvatar: AvatarData;
  draggedCube: DraggedCubeData | null;
  addCube: (x: number, y: number, z: number) => void;
  removeCube: (x: number, y: number, z: number) => void;
  setTexture: (texture: string) => void;
  setShape: (shape: ShapeType) => void;
  setScale: (scale: number) => void;
  setInWater: (inWater: boolean) => void;
  setCameraMode: (mode: CameraMode) => void;
  setCameraDistance: (distance: number) => void;
  setPlayerAvatar: (avatar: Partial<AvatarData>) => void;
  setNPCThinking: (id: string, isThinking: boolean, task?: string) => void;
  setNPCMessage: (id: string, message: string | null) => void;
  addNPCThought: (id: string, thought: string, decision: string) => void;
  bulkAddCubes: (cubes: { x: number; y: number; z: number; texture: string; shape?: ShapeType; scale?: number; rotation?: [number, number, number]; color?: string }[]) => void;
  addNPC: (x: number, y: number, z: number, name: string, color: string, style?: string, clothingColor?: string, hairColor?: string) => void;
  updateNPC: (id: string, data: Partial<NPCData>) => void;
  saveWorld: () => void;
  resetWorld: () => void;
  setShowMap: (show: boolean) => void;
  teleportPlayer: (pos: [number, number, number]) => void;
  setDraggedCube: (cube: DraggedCubeData | null) => void;
}

const getLocalStorage = (key: string) => JSON.parse(window.localStorage.getItem(key) || '[]');
const setLocalStorage = (key: string, value: any) => window.localStorage.setItem(key, JSON.stringify(value));

export const useStore = create<GameState>((set) => ({
  texture: 'grass',
  shape: 'cube',
  scale: 1,
  cameraMode: 'first',
  playerAvatar: {
    color: '#ffcc00',
    style: 'casual',
    name: 'Player',
    clothingColor: '#3b82f6',
    hairColor: '#4b2c20',
  },
  cubes: getLocalStorage('cubes') || [],
  npcs: [
    { id: 'npc-1', pos: [5, 0, 5], name: 'Builder Bob', color: '#ffcc00', style: 'worker', clothingColor: '#f97316', hairColor: '#1a1a1a' },
    { id: 'npc-2', pos: [-5, 0, -5], name: 'Creative Cathy', color: '#ff66cc', style: 'artist', clothingColor: '#8b5cf6', hairColor: '#fbbf24' },
  ],
  isInWater: false,
  showMap: false,
  cameraDistance: 5,
  draggedCube: null,
  setDraggedCube: (cube) => set({ draggedCube: cube }),
  addCube: (x, y, z) => {
    set((state) => ({
      cubes: [
        ...state.cubes,
        {
          id: nanoid(),
          pos: [x, y, z],
          texture: state.texture,
          shape: state.shape,
          scale: state.scale,
        },
      ],
    }));
  },
  bulkAddCubes: (newCubes) => {
    set((state) => {
      const existingPositions = new Set(state.cubes.map(c => c.pos.join(',')));
      const filteredNewCubes = newCubes
        .filter(nc => !existingPositions.has(`${nc.x},${nc.y},${nc.z}`))
        .map(nc => ({
          id: nanoid(),
          pos: [nc.x, nc.y, nc.z] as [number, number, number],
          texture: nc.texture,
          shape: nc.shape || 'cube',
          scale: nc.scale || 1,
          rotation: nc.rotation || [0, 0, 0],
          color: nc.color || '#ffffff',
        }));
      return {
        cubes: [...state.cubes, ...filteredNewCubes],
      };
    });
  },
  addNPC: (x, y, z, name, color, style, clothingColor, hairColor) => {
    set((state) => ({
      npcs: [
        ...state.npcs,
        {
          id: nanoid(),
          pos: [x, y, z],
          name,
          color,
          style,
          clothingColor,
          hairColor,
        },
      ],
    }));
  },
  updateNPC: (id, data) => {
    set((state) => ({
      npcs: state.npcs.map((npc) => (npc.id === id ? { ...npc, ...data } : npc)),
    }));
  },
  addNPCThought: (id, thought, decision) => {
    set((state) => ({
      npcs: state.npcs.map((npc) => {
        if (npc.id === id) {
          const newThought = { timestamp: Date.now(), thought, decision };
          const thoughtHistory = [...(npc.thoughtHistory || []), newThought].slice(-10); // Keep last 10
          return { ...npc, thoughtHistory };
        }
        return npc;
      }),
    }));
  },
  removeCube: (x, y, z) => {
    set((state) => ({
      cubes: state.cubes.filter((cube) => {
        const [cx, cy, cz] = cube.pos;
        return cx !== x || cy !== y || cz !== z;
      }),
    }));
  },
  setTexture: (texture) => {
    set((state) => {
      if (state.texture === texture) return state;
      return { texture };
    });
  },
  setShape: (shape) => {
    set((state) => {
      if (state.shape === shape) return state;
      return { shape };
    });
  },
  setScale: (scale) => {
    set((state) => {
      if (state.scale === scale) return state;
      return { scale };
    });
  },
  setInWater: (isInWater) => {
    set((state) => {
      if (state.isInWater === isInWater) return state;
      return { isInWater };
    });
  },
  setCameraMode: (cameraMode) => {
    set((state) => {
      if (state.cameraMode === cameraMode) return state;
      return { cameraMode };
    });
  },
  setCameraDistance: (cameraDistance) => {
    set((state) => {
      if (state.cameraDistance === cameraDistance) return state;
      return { cameraDistance };
    });
  },
  setPlayerAvatar: (avatar) => {
    set((state) => ({
      playerAvatar: { ...state.playerAvatar, ...avatar },
    }));
  },
  setNPCThinking: (id, isThinking, task) => {
    set((state) => ({
      npcs: state.npcs.map((npc) => (npc.id === id ? { ...npc, isThinking, currentTask: task } : npc)),
    }));
  },
  setNPCMessage: (id, message) => {
    set((state) => ({
      npcs: state.npcs.map((npc) => (npc.id === id ? { ...npc, currentMessage: message || undefined } : npc)),
    }));
  },
  saveWorld: () => {
    set((state) => {
      setLocalStorage('cubes', state.cubes);
      return state;
    });
  },
  resetWorld: () => {
    set(() => ({
      cubes: [],
    }));
  },
  setShowMap: (showMap) => set({ showMap }),
  teleportPlayer: (pos) => {
    // This will be handled by the Player component observing this state or a ref
    // For now, we'll just emit an event or use a specific state that Player listens to
    window.dispatchEvent(new CustomEvent('teleport-player', { detail: pos }));
  },
}));
