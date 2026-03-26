/**
 * World API — canonical world authority.
 * Owns all world writes. Validates permissions, budgets, collisions.
 */
import express from 'express';
import { nanoid } from 'nanoid';
import { CONFIG, PlaceActionRequest, RemoveActionRequest, VoxelData, WorldDiff, NPCDoc } from '../../shared/schemas';
import * as firestore from '../../shared/firestoreService';
import { pubsubService } from '../../shared/pubsubService';
import { redisService } from '../../shared/redisService';
import { storageService } from '../../shared/storageService';

const router = express.Router();

// ── World CRUD ──────────────────────────────────────────────────

// GET /world/:worldId — get world metadata + all voxels
router.get('/world/:worldId', async (req, res) => {
  try {
    const { worldId } = req.params;
    let world = await firestore.getWorld(worldId);
    if (!world) {
      // Auto-create the default world
      world = await firestore.createWorld(worldId, { name: 'Voxel Kids World' });
    }
    const voxels = await firestore.getAllVoxels(worldId);
    const npcs = await firestore.getNPCs(worldId);
    res.json({ world, voxels, npcs });
  } catch (err: any) {
    console.error('GET /world error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /world/:worldId/snapshot — save full world snapshot to GCS
router.post('/world/:worldId/snapshot', async (req, res) => {
  try {
    const { worldId } = req.params;
    const voxels = await firestore.getAllVoxels(worldId);
    const npcs = await firestore.getNPCs(worldId);
    const world = await firestore.getWorld(worldId);
    const path = await storageService.saveSnapshot(worldId, { world, voxels, npcs, timestamp: Date.now() });
    res.json({ snapshotPath: path });
  } catch (err: any) {
    console.error('POST /snapshot error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Validated World Actions ─────────────────────────────────────

// POST /world/:worldId/actions/place — place voxels with validation
router.post('/world/:worldId/actions/place', async (req, res) => {
  try {
    const { worldId } = req.params;
    const body = req.body as PlaceActionRequest;
    const { sourceType, sourceId, voxels: rawVoxels } = body;

    if (!rawVoxels || rawVoxels.length === 0) {
      return res.status(400).json({ error: 'No voxels provided' });
    }

    // ── Validation Pipeline ──

    // 1. Budget check for NPCs
    if (sourceType === 'npc') {
      const npc = await firestore.getNPC(worldId, sourceId);
      if (!npc) return res.status(404).json({ error: 'NPC not found' });

      const budget = npc.creativeBudget;
      if (budget.used.voxelsPlaced + rawVoxels.length > budget.hourly.voxelsPlaced) {
        return res.status(429).json({
          error: 'NPC voxel budget exceeded',
          remaining: budget.hourly.voxelsPlaced - budget.used.voxelsPlaced,
        });
      }
    }

    // 2. Plot protection check
    for (const v of rawVoxels) {
      // TODO: Implement full plot boundary check when plots are created
      // For now, basic ground-level protection
      if (v.y < -1) {
        return res.status(403).json({ error: 'Cannot place below ground level' });
      }
    }

    // 3. Convert to VoxelData and add
    const voxelDatas: VoxelData[] = rawVoxels.map(v => ({
      id: nanoid(),
      pos: [v.x, v.y, v.z] as [number, number, number],
      texture: v.texture,
      shape: v.shape || 'cube',
      scale: v.scale || 1,
      rotation: v.rotation || [0, 0, 0],
      color: v.color || '#ffffff',
    }));

    await firestore.addVoxels(worldId, voxelDatas);

    // 4. Update NPC budget
    if (sourceType === 'npc') {
      await firestore.upsertNPC(worldId, sourceId, {
        lastActedAt: Date.now(),
      } as any); // Budget increment is tracked separately
    }

    // 5. Publish world diff
    const revision = await firestore.incrementWorldVersion(worldId);
    const diff: WorldDiff = {
      worldId,
      revision,
      timestamp: Date.now(),
      added: voxelDatas,
      removed: [],
      npcUpdates: [],
    };

    try { await pubsubService.publishWorldChanged(diff); } catch (e) { /* non-critical */ }

    // 6. Log event
    await firestore.logEvent(worldId, {
      type: 'voxels.placed',
      source: { type: sourceType, id: sourceId },
      payload: { count: voxelDatas.length, voxelIds: voxelDatas.map(v => v.id) },
      fanoutTargets: [],
    });

    res.json({ placed: voxelDatas.length, revision, voxels: voxelDatas });
  } catch (err: any) {
    console.error('POST /actions/place error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /world/:worldId/actions/remove — remove voxels with validation
router.post('/world/:worldId/actions/remove', async (req, res) => {
  try {
    const { worldId } = req.params;
    const body = req.body as RemoveActionRequest;
    const { sourceType, sourceId, positions } = body;

    if (!positions || positions.length === 0) {
      return res.status(400).json({ error: 'No positions provided' });
    }

    // Budget check for NPCs — destructive edits are more expensive
    if (sourceType === 'npc') {
      const npc = await firestore.getNPC(worldId, sourceId);
      if (!npc) return res.status(404).json({ error: 'NPC not found' });

      const budget = npc.creativeBudget;
      if (budget.used.destructiveEdits + positions.length > budget.hourly.destructiveEdits) {
        return res.status(429).json({ error: 'NPC destructive edit budget exceeded' });
      }
    }

    const removedIds = await firestore.removeVoxels(worldId, positions);
    const revision = await firestore.incrementWorldVersion(worldId);

    const diff: WorldDiff = {
      worldId,
      revision,
      timestamp: Date.now(),
      added: [],
      removed: removedIds,
      npcUpdates: [],
    };

    try { await pubsubService.publishWorldChanged(diff); } catch (e) { /* non-critical */ }

    await firestore.logEvent(worldId, {
      type: 'voxels.removed',
      source: { type: sourceType, id: sourceId },
      payload: { count: removedIds.length, removedIds },
      fanoutTargets: [],
    });

    res.json({ removed: removedIds.length, revision });
  } catch (err: any) {
    console.error('POST /actions/remove error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── NPC Management ──────────────────────────────────────────────

// GET /world/:worldId/npcs
router.get('/world/:worldId/npcs', async (req, res) => {
  try {
    const npcs = await firestore.getNPCs(req.params.worldId);
    res.json(npcs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /world/:worldId/npcs/:npcId — upsert NPC
router.post('/world/:worldId/npcs/:npcId', async (req, res) => {
  try {
    await firestore.upsertNPC(req.params.worldId, req.params.npcId, req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
