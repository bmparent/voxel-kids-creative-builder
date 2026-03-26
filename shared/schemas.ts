/**
 * Shared data schemas for the Voxel Kids world.
 * These TypeScript interfaces mirror the Firestore document structures.
 */

// ── World ───────────────────────────────────────────────────────
export interface WorldDoc {
  name: string;
  seed: number;
  biome: string;
  stylePreset: string;
  currentSeason: 'spring' | 'summer' | 'autumn' | 'winter';
  currentWeather: 'clear' | 'rain' | 'snow' | 'fog';
  activeEventIds: string[];
  worldVersion: number;
  snapshotPointer: string | null;
  createdAt: number;
  updatedAt: number;
}

// ── Chunk ───────────────────────────────────────────────────────
export interface ChunkDoc {
  revision: number;
  hash: string;
  storagePointer: string; // GCS path for heavy voxel data
  districtId: string;
  reservedBy: string | null;
  dirty: boolean;
  lastModifiedAt: number;
}

export interface ChunkPayload {
  chunkId: string;
  voxels: VoxelData[];
}

export interface VoxelData {
  id: string;
  pos: [number, number, number];
  texture: string;
  shape: ShapeType;
  scale: number;
  rotation: [number, number, number];
  color: string;
}

export type ShapeType = 'cube' | 'sphere' | 'pyramid' | 'cylinder' | 'tree' | 'rock' | 'bush' | 'flower' | 'lamp' | 'fence';

// ── District ────────────────────────────────────────────────────
export interface DistrictDoc {
  name: string;
  type: string;
  styleRules: StyleRules;
  zoningRules: ZoningRules;
  isPublic: boolean;
  allowedNpcRoles: string[];
  landmarkIds: string[];
  activeProjects: string[];
  desiredBeautificationScore: number;
}

export interface StyleRules {
  allowedMaterials: string[];
  allowedShapes: ShapeType[];
  colorPalette: string[];
  maxHeight: number;
}

export interface ZoningRules {
  maxDensity: number; // voxels per unit area
  minSpacing: number;
  allowDestructive: boolean;
}

// ── Plot ────────────────────────────────────────────────────────
export interface PlotDoc {
  ownerType: 'player' | 'npc' | 'public';
  ownerId: string | null;
  boundaries: { minX: number; minZ: number; maxX: number; maxZ: number };
  editPermissions: 'owner' | 'district' | 'anyone';
  protectionLevel: 'none' | 'soft' | 'hard'; // hard = cannot be edited
  buildBudgetRules: { maxVoxels: number; maxProps: number };
  styleConstraints: string[];
  reservationState: {
    reservedBy: string | null;
    reservedUntil: number | null;
    projectId: string | null;
  };
}

// ── NPC ─────────────────────────────────────────────────────────
export type NPCRole = 'gardener' | 'builder' | 'shopkeeper' | 'mayor' | 'artist' | 'guide' | 'worker';

export interface NPCDoc {
  name: string;
  role: NPCRole;
  traits: string[];
  color: string;
  clothingColor: string;
  hairColor: string;
  style: string;
  homePlot: string | null;
  workPlot: string | null;
  pos: [number, number, number];
  dailySchedule: ScheduleEntry[];
  currentActivity: string;
  thinkerPriority: number; // 0–10, higher = more important
  activeProjectId: string | null;
  allowedTools: string[];
  creativeBudget: CreativeBudget;
  lastThoughtAt: number;
  lastActedAt: number;
}

export interface ScheduleEntry {
  hour: number;
  activity: string;
  location: string;
}

export interface CreativeBudget {
  daily: BudgetLimits;
  hourly: BudgetLimits;
  used: BudgetLimits;
  lastResetAt: number;
}

export interface BudgetLimits {
  voxelsPlaced: number;
  propsSpawned: number;
  destructiveEdits: number;
  majorProposals: number;
  speechTurns: number;
  plannerCalls: number;
}

// ── Memory ──────────────────────────────────────────────────────
export interface MemoryDoc {
  subjectType: 'npc' | 'player' | 'world' | 'district';
  subjectId: string;
  scope: 'local' | 'district' | 'world' | 'relationship';
  summary: string;
  tags: string[];
  importance: number; // 0–10
  recencyScore: number;
  sourceEventIds: string[];
  artifactPointer: string | null;
  createdAt: number;
}

// ── Event ───────────────────────────────────────────────────────
export interface WorldEventDoc {
  type: string;
  source: { type: 'player' | 'npc' | 'system'; id: string };
  payload: Record<string, any>;
  timestamp: number;
  status: 'pending' | 'applied' | 'rejected' | 'failed';
  fanoutTargets: string[];
}

// ── Project ─────────────────────────────────────────────────────
export interface ProjectDoc {
  initiator: { type: 'npc' | 'system' | 'player'; id: string };
  projectType: string;
  targetPlotOrDistrict: string;
  semanticGoal: string;
  currentPhase: 'proposed' | 'approved' | 'compiling' | 'executing' | 'completed' | 'failed' | 'rolled-back';
  approvalStatus: 'pending' | 'auto-approved' | 'approved' | 'rejected';
  compiledPlanPointer: string | null;
  progress: number; // 0–100
  rollbackPointer: string | null;
  createdAt: number;
  updatedAt: number;
}

// ── Action Requests (world-api input) ───────────────────────────
export interface PlaceActionRequest {
  worldId: string;
  sourceType: 'player' | 'npc';
  sourceId: string;
  voxels: Array<{
    x: number;
    y: number;
    z: number;
    texture: string;
    shape?: ShapeType;
    scale?: number;
    rotation?: [number, number, number];
    color?: string;
  }>;
}

export interface RemoveActionRequest {
  worldId: string;
  sourceType: 'player' | 'npc';
  sourceId: string;
  positions: Array<[number, number, number]>;
}

// ── World Diff (published to clients) ───────────────────────────
export interface WorldDiff {
  worldId: string;
  revision: number;
  timestamp: number;
  added: VoxelData[];
  removed: string[]; // voxel IDs
  npcUpdates: Array<{ id: string; data: Partial<NPCDoc> }>;
}

// ── Config ──────────────────────────────────────────────────────
export const CONFIG = {
  GCP_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || 'hive-core-vertex-bmparent',
  GCS_BUCKET: process.env.GCS_BUCKET || 'voxel-kids-worlds',
  PUBSUB_TOPIC: process.env.PUBSUB_TOPIC || 'world-events',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  DEFAULT_WORLD_ID: 'world-default',
  MAX_CONCURRENT_THINKERS: 5,
  MAX_VOICE_NPCS: 2,
  THINKER_INTERVAL_MS: 15000,
  NPC_COOLDOWN_MS: 45000,
};
