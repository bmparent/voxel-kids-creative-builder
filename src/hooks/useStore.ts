/**
 * useStore — backward-compatible facade over domain stores.
 * 
 * All existing component imports (`import { useStore } from '../hooks/useStore'`)
 * continue to work unchanged. Under the hood, state is delegated to:
 *   - worldStore (cubes, textures, shapes, scales)
 *   - npcStore (NPCs, thinking, messages)
 *   - playerStore (avatar, camera, water, dragged cube)
 *   - uiStore (map, help, customizer)
 */
import { create } from 'zustand';
import { useWorldStore, CubeData, ShapeType } from '../stores/worldStore';
import { useNPCStore, NPCData } from '../stores/npcStore';
import { usePlayerStore, AvatarData, CameraMode, DraggedCubeData } from '../stores/playerStore';
import { useUIStore } from '../stores/uiStore';
import { saveWorldToServer } from '../network/syncService';

// Re-export types for backward compat
export type { CubeData, ShapeType, NPCData, AvatarData, CameraMode, DraggedCubeData };

/**
 * Combined game state interface — matches the original useStore signature.
 * Components don't need to change their selectors.
 */
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

/**
 * Facade store that reads from and writes to the domain stores.
 * Uses Zustand's subscribe mechanism to stay in sync.
 */
export const useStore = create<GameState>((set, get) => {
  // Subscribe to domain stores and mirror their state
  useWorldStore.subscribe((worldState) => {
    set({
      cubes: worldState.cubes,
      texture: worldState.texture,
      shape: worldState.shape,
      scale: worldState.scale,
    });
  });

  useNPCStore.subscribe((npcState) => {
    set({ npcs: npcState.npcs });
  });

  usePlayerStore.subscribe((playerState) => {
    set({
      playerAvatar: playerState.playerAvatar,
      cameraMode: playerState.cameraMode,
      cameraDistance: playerState.cameraDistance,
      isInWater: playerState.isInWater,
      draggedCube: playerState.draggedCube,
    });
  });

  useUIStore.subscribe((uiState) => {
    set({ showMap: uiState.showMap });
  });

  // Initial state from domain stores
  const world = useWorldStore.getState();
  const npc = useNPCStore.getState();
  const player = usePlayerStore.getState();
  const ui = useUIStore.getState();

  return {
    // ── Mirrored state ──
    texture: world.texture,
    shape: world.shape,
    scale: world.scale,
    cubes: world.cubes,
    npcs: npc.npcs,
    isInWater: player.isInWater,
    cameraMode: player.cameraMode,
    cameraDistance: player.cameraDistance,
    showMap: ui.showMap,
    playerAvatar: player.playerAvatar,
    draggedCube: player.draggedCube,

    // ── Delegated actions ──
    addCube: (x, y, z) => useWorldStore.getState().addCube(x, y, z),
    removeCube: (x, y, z) => useWorldStore.getState().removeCube(x, y, z),
    bulkAddCubes: (cubes) => useWorldStore.getState().bulkAddCubes(cubes),
    setTexture: (t) => useWorldStore.getState().setTexture(t),
    setShape: (s) => useWorldStore.getState().setShape(s),
    setScale: (s) => useWorldStore.getState().setScale(s),
    resetWorld: () => useWorldStore.getState().resetWorld(),

    addNPC: (x, y, z, name, color, style, cc, hc) => useNPCStore.getState().addNPC(x, y, z, name, color, style, cc, hc),
    updateNPC: (id, data) => useNPCStore.getState().updateNPC(id, data),
    setNPCThinking: (id, t, task) => useNPCStore.getState().setNPCThinking(id, t, task),
    setNPCMessage: (id, msg) => useNPCStore.getState().setNPCMessage(id, msg),
    addNPCThought: (id, thought, dec) => useNPCStore.getState().addNPCThought(id, thought, dec),

    setPlayerAvatar: (a) => usePlayerStore.getState().setPlayerAvatar(a),
    setCameraMode: (m) => usePlayerStore.getState().setCameraMode(m),
    setCameraDistance: (d) => usePlayerStore.getState().setCameraDistance(d),
    setInWater: (w) => usePlayerStore.getState().setInWater(w),
    setDraggedCube: (c) => usePlayerStore.getState().setDraggedCube(c),
    teleportPlayer: (pos) => usePlayerStore.getState().teleportPlayer(pos),

    setShowMap: (s) => useUIStore.getState().setShowMap(s),

    saveWorld: () => {
      saveWorldToServer();
    },
  };
});
