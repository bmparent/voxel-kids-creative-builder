/**
 * Firestore service — centralized read/write for world data.
 */
import admin from 'firebase-admin';
import { CONFIG, WorldDoc, ChunkDoc, NPCDoc, PlotDoc, DistrictDoc, MemoryDoc, WorldEventDoc, ProjectDoc, VoxelData, ChunkPayload } from './schemas';
import { storageService } from './storageService';
import { nanoid } from 'nanoid';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: CONFIG.GCP_PROJECT,
  });
}

const db = admin.firestore();

// ── World ───────────────────────────────────────────────────────
export async function getWorld(worldId: string): Promise<WorldDoc | null> {
  const doc = await db.collection('worlds').doc(worldId).get();
  return doc.exists ? (doc.data() as WorldDoc) : null;
}

export async function createWorld(worldId: string, data: Partial<WorldDoc>): Promise<WorldDoc> {
  const world: WorldDoc = {
    name: data.name || 'New World',
    seed: data.seed || Math.floor(Math.random() * 100000),
    biome: data.biome || 'temperate',
    stylePreset: data.stylePreset || 'default',
    currentSeason: data.currentSeason || 'spring',
    currentWeather: data.currentWeather || 'clear',
    activeEventIds: [],
    worldVersion: 1,
    snapshotPointer: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.collection('worlds').doc(worldId).set(world);
  return world;
}

export async function incrementWorldVersion(worldId: string): Promise<number> {
  const ref = db.collection('worlds').doc(worldId);
  const result = await db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const current = doc.data()?.worldVersion || 0;
    const next = current + 1;
    tx.update(ref, { worldVersion: next, updatedAt: Date.now() });
    return next;
  });
  return result;
}

// ── Chunks ──────────────────────────────────────────────────────
export function getChunkId(x: number, z: number, chunkSize = 16): string {
  const cx = Math.floor(x / chunkSize);
  const cz = Math.floor(z / chunkSize);
  return `${cx}_${cz}`;
}

export async function getChunkPayload(worldId: string, chunkId: string): Promise<ChunkPayload | null> {
  const chunkDoc = await db.collection('worlds').doc(worldId).collection('chunks').doc(chunkId).get();
  if (!chunkDoc.exists) return null;
  const meta = chunkDoc.data() as ChunkDoc;
  if (!meta.storagePointer) return { chunkId, voxels: [] };
  // Load heavy voxel data from GCS
  return storageService.downloadChunk(meta.storagePointer);
}

export async function saveChunkPayload(worldId: string, chunkId: string, payload: ChunkPayload, districtId = 'default'): Promise<void> {
  const storagePath = `worlds/${worldId}/chunks/${chunkId}.json`;
  await storageService.uploadChunk(storagePath, payload);

  const hash = simpleHash(JSON.stringify(payload.voxels));
  const meta: ChunkDoc = {
    revision: admin.firestore.FieldValue.increment(1) as any,
    hash,
    storagePointer: storagePath,
    districtId,
    reservedBy: null,
    dirty: false,
    lastModifiedAt: Date.now(),
  };
  await db.collection('worlds').doc(worldId).collection('chunks').doc(chunkId).set(meta, { merge: true });
}

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

// ── All voxels (convenience for migration from flat array) ─────
export async function getAllVoxels(worldId: string): Promise<VoxelData[]> {
  const chunksSnap = await db.collection('worlds').doc(worldId).collection('chunks').get();
  const allVoxels: VoxelData[] = [];
  for (const chunkDoc of chunksSnap.docs) {
    const meta = chunkDoc.data() as ChunkDoc;
    if (meta.storagePointer) {
      const payload = await storageService.downloadChunk(meta.storagePointer);
      if (payload) allVoxels.push(...payload.voxels);
    }
  }
  return allVoxels;
}

export async function addVoxels(worldId: string, voxels: VoxelData[]): Promise<void> {
  // Group voxels by chunk
  const byChunk = new Map<string, VoxelData[]>();
  for (const v of voxels) {
    const cid = getChunkId(v.pos[0], v.pos[2]);
    if (!byChunk.has(cid)) byChunk.set(cid, []);
    byChunk.get(cid)!.push(v);
  }

  for (const [chunkId, chunkVoxels] of byChunk) {
    const existing = await getChunkPayload(worldId, chunkId);
    const merged = existing ? [...existing.voxels] : [];
    const existingPositions = new Set(merged.map(v => v.pos.join(',')));
    for (const v of chunkVoxels) {
      if (!existingPositions.has(v.pos.join(','))) {
        merged.push(v);
      }
    }
    await saveChunkPayload(worldId, chunkId, { chunkId, voxels: merged });
  }
}

export async function removeVoxels(worldId: string, positions: Array<[number, number, number]>): Promise<string[]> {
  const removedIds: string[] = [];
  const byChunk = new Map<string, Array<[number, number, number]>>();
  for (const pos of positions) {
    const cid = getChunkId(pos[0], pos[2]);
    if (!byChunk.has(cid)) byChunk.set(cid, []);
    byChunk.get(cid)!.push(pos);
  }

  for (const [chunkId, chunkPositions] of byChunk) {
    const existing = await getChunkPayload(worldId, chunkId);
    if (!existing) continue;
    const posSet = new Set(chunkPositions.map(p => p.join(',')));
    const kept: VoxelData[] = [];
    for (const v of existing.voxels) {
      if (posSet.has(v.pos.join(','))) {
        removedIds.push(v.id);
      } else {
        kept.push(v);
      }
    }
    await saveChunkPayload(worldId, chunkId, { chunkId, voxels: kept });
  }
  return removedIds;
}

// ── NPCs ────────────────────────────────────────────────────────
export async function getNPCs(worldId: string): Promise<Array<NPCDoc & { id: string }>> {
  const snap = await db.collection('worlds').doc(worldId).collection('npcs').get();
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as NPCDoc) }));
}

export async function getNPC(worldId: string, npcId: string): Promise<(NPCDoc & { id: string }) | null> {
  const doc = await db.collection('worlds').doc(worldId).collection('npcs').doc(npcId).get();
  return doc.exists ? { id: doc.id, ...(doc.data() as NPCDoc) } : null;
}

export async function upsertNPC(worldId: string, npcId: string, data: Partial<NPCDoc>): Promise<void> {
  await db.collection('worlds').doc(worldId).collection('npcs').doc(npcId).set(data, { merge: true });
}

// ── Plots ───────────────────────────────────────────────────────
export async function getPlot(worldId: string, plotId: string): Promise<PlotDoc | null> {
  const doc = await db.collection('worlds').doc(worldId).collection('plots').doc(plotId).get();
  return doc.exists ? (doc.data() as PlotDoc) : null;
}

export async function upsertPlot(worldId: string, plotId: string, data: Partial<PlotDoc>): Promise<void> {
  await db.collection('worlds').doc(worldId).collection('plots').doc(plotId).set(data, { merge: true });
}

// ── Memories ────────────────────────────────────────────────────
export async function addMemory(worldId: string, data: Omit<MemoryDoc, 'createdAt'>): Promise<string> {
  const id = nanoid();
  await db.collection('worlds').doc(worldId).collection('memories').doc(id).set({
    ...data,
    createdAt: Date.now(),
  });
  return id;
}

export async function getRecentMemories(worldId: string, subjectId: string, limit = 5): Promise<MemoryDoc[]> {
  const snap = await db.collection('worlds').doc(worldId).collection('memories')
    .where('subjectId', '==', subjectId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map(d => d.data() as MemoryDoc);
}

// ── Events ──────────────────────────────────────────────────────
export async function logEvent(worldId: string, event: Omit<WorldEventDoc, 'timestamp' | 'status'>): Promise<string> {
  const id = nanoid();
  await db.collection('worlds').doc(worldId).collection('events').doc(id).set({
    ...event,
    timestamp: Date.now(),
    status: 'applied',
  });
  return id;
}

// ── Firestore ref helpers ───────────────────────────────────────
export { db };
