/**
 * Tool Executor — executes validated tool calls from the NPC action compiler.
 * All tool calls go through the world-api validator before mutating state.
 */
import { nanoid } from 'nanoid';
import * as firestore from '../../shared/firestoreService';
import { pubsubService } from '../../shared/pubsubService';
import { redisService } from '../../shared/redisService';
import { VoxelData, ShapeType } from '../../shared/schemas';

export async function executeToolCall(
  worldId: string,
  npcId: string,
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  console.log(`🔧 NPC ${npcId} calling tool: ${toolName}`, JSON.stringify(args).slice(0, 200));

  switch (toolName) {
    // ── Perception ──
    case 'get_local_patch':
      return executeGetLocalPatch(worldId, npcId, args.radius || 16);

    case 'get_nearby_entities':
      return executeGetNearbyEntities(worldId, npcId, args.radius || 16);

    // ── World Editing ──
    case 'place_prop':
    case 'plant_flora':
      return executePlaceItems(worldId, npcId, toolName, args);

    case 'place_voxel_pattern':
      return executePlaceVoxelPattern(worldId, npcId, args);

    case 'create_path':
      return executeCreatePath(worldId, npcId, args);

    case 'remove_prop':
      return executeRemoveProp(worldId, npcId, args);

    // ── Social ──
    case 'speak':
      return executeSpeak(worldId, npcId, args);

    case 'leave_gift':
      return executeLeaveGift(worldId, npcId, args);

    // ── Memory ──
    case 'write_memory':
      return executeWriteMemory(worldId, npcId, args);

    // ── Action Proposal ──
    case 'propose_project':
      return executeProposeProject(worldId, npcId, args);

    case 'reserve_plot':
      return executeReservePlot(worldId, npcId, args);

    case 'release_plot':
      return executeReleasePlot(worldId, npcId, args);

    default:
      console.warn(`Unknown tool: ${toolName}`);
      return { error: `Unknown tool: ${toolName}` };
  }
}

async function executeGetLocalPatch(worldId: string, npcId: string, radius: number) {
  const npc = await firestore.getNPC(worldId, npcId);
  if (!npc) return { error: 'NPC not found' };

  const allVoxels = await firestore.getAllVoxels(worldId);
  const [nx, , nz] = npc.pos;
  const nearby = allVoxels.filter(v => {
    const dx = v.pos[0] - nx;
    const dz = v.pos[2] - nz;
    return Math.sqrt(dx * dx + dz * dz) <= radius;
  });

  return { blockCount: nearby.length, blocks: nearby.slice(0, 50) }; // Cap returned blocks
}

async function executeGetNearbyEntities(worldId: string, npcId: string, radius: number) {
  const npc = await firestore.getNPC(worldId, npcId);
  if (!npc) return { error: 'NPC not found' };

  const allNPCs = await firestore.getNPCs(worldId);
  const [nx, , nz] = npc.pos;
  return allNPCs
    .filter(n => n.id !== npcId)
    .filter(n => {
      const dx = n.pos[0] - nx;
      const dz = n.pos[2] - nz;
      return Math.sqrt(dx * dx + dz * dz) <= radius;
    })
    .map(n => ({ id: n.id, name: n.name, role: n.role, activity: n.currentActivity }));
}

async function executePlaceItems(worldId: string, npcId: string, toolName: string, args: any) {
  const npc = await firestore.getNPC(worldId, npcId);
  if (!npc) return { error: 'NPC not found' };

  const shapeMap: Record<string, ShapeType> = {
    flower: 'flower', bush: 'bush', tree: 'tree', grass_patch: 'bush', vine: 'bush',
    bench: 'cube', lantern: 'lamp', sign: 'fence', barrel: 'cylinder', crate: 'cube',
    well: 'cylinder', fountain: 'sphere',
  };

  let positions: Array<{ x: number; y: number; z: number }>;
  let shape: ShapeType;
  let texture: string;

  if (toolName === 'plant_flora') {
    positions = args.positions || [{ x: npc.pos[0], y: 0, z: npc.pos[2] }];
    shape = shapeMap[args.species] || 'flower';
    texture = 'grass';
  } else {
    positions = [{ x: args.x, y: args.y || 0, z: args.z }];
    shape = shapeMap[args.propType] || 'cube';
    texture = 'wood';
  }

  // Cap at 10 placements per call
  positions = positions.slice(0, 10);

  const voxels: VoxelData[] = positions.map(p => ({
    id: nanoid(),
    pos: [p.x, p.y, p.z] as [number, number, number],
    texture,
    shape,
    scale: 1,
    rotation: [0, 0, 0] as [number, number, number],
    color: args.styleTags?.includes('warm') ? '#f59e0b' : '#ffffff',
  }));

  await firestore.addVoxels(worldId, voxels);

  try {
    await pubsubService.publishNPCAction(worldId, npcId, toolName, { count: voxels.length });
  } catch { /* non-critical */ }

  return { placed: voxels.length };
}

async function executePlaceVoxelPattern(worldId: string, npcId: string, args: any) {
  let voxels = args.voxels || [];
  // Hard cap: max 20 voxels per pattern (Mission §5 rule)
  if (voxels.length > 20) {
    voxels = voxels.slice(0, 20);
  }

  const { anchorX = 0, anchorY = 0, anchorZ = 0 } = args;

  const placed: VoxelData[] = voxels.map((v: any) => ({
    id: nanoid(),
    pos: [v.x + anchorX, v.y + anchorY, v.z + anchorZ] as [number, number, number],
    texture: v.texture || 'stone',
    shape: v.shape || 'cube',
    scale: 1,
    rotation: [0, 0, 0] as [number, number, number],
    color: v.color || '#ffffff',
  }));

  await firestore.addVoxels(worldId, placed);
  return { placed: placed.length };
}

async function executeCreatePath(worldId: string, npcId: string, args: any) {
  const points = args.points || [];
  const material = args.material || 'stone';
  const width = Math.min(args.width || 1, 3);

  const voxels: VoxelData[] = [];
  for (let i = 0; i < points.length - 1 && voxels.length < 30; i++) {
    const from = points[i];
    const to = points[i + 1];
    // Simple linear interpolation
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const steps = Math.max(Math.abs(dx), Math.abs(dz));
    for (let s = 0; s <= steps && voxels.length < 30; s++) {
      const x = Math.round(from.x + (dx * s) / Math.max(steps, 1));
      const z = Math.round(from.z + (dz * s) / Math.max(steps, 1));
      for (let w = 0; w < width; w++) {
        voxels.push({
          id: nanoid(),
          pos: [x, 0, z + w] as [number, number, number],
          texture: material,
          shape: 'cube',
          scale: 1,
          rotation: [0, 0, 0],
          color: '#ffffff',
        });
      }
    }
  }

  await firestore.addVoxels(worldId, voxels);
  return { placed: voxels.length };
}

async function executeRemoveProp(_worldId: string, _npcId: string, _args: any) {
  // TODO: Implement prop removal when prop registry is added
  return { removed: 0 };
}

async function executeSpeak(worldId: string, npcId: string, args: any) {
  // Log speech as memory/event
  await firestore.logEvent(worldId, {
    type: 'npc.speech',
    source: { type: 'npc', id: npcId },
    payload: { text: args.text?.slice(0, 200), tone: args.tone || 'friendly' },
    fanoutTargets: [],
  });
  return { spoken: true };
}

async function executeLeaveGift(worldId: string, npcId: string, args: any) {
  await firestore.addMemory(worldId, {
    subjectType: 'npc',
    subjectId: npcId,
    scope: 'relationship',
    summary: `Left a ${args.giftType} for ${args.targetEntityId}${args.note ? `: "${args.note}"` : ''}`,
    tags: ['gift', args.giftType],
    importance: 5,
    recencyScore: 1,
    sourceEventIds: [],
    artifactPointer: null,
  });
  return { gifted: true };
}

async function executeWriteMemory(worldId: string, npcId: string, args: any) {
  const id = await firestore.addMemory(worldId, {
    subjectType: 'npc',
    subjectId: npcId,
    scope: 'local',
    summary: args.summary?.slice(0, 500),
    tags: args.tags || [],
    importance: Math.min(args.importance || 3, 10),
    recencyScore: 1,
    sourceEventIds: [],
    artifactPointer: null,
  });
  return { memoryId: id };
}

async function executeProposeProject(worldId: string, npcId: string, args: any) {
  await firestore.logEvent(worldId, {
    type: 'project.proposed',
    source: { type: 'npc', id: npcId },
    payload: { projectType: args.projectType, summary: args.summary, targetId: args.targetId, style: args.style },
    fanoutTargets: [],
  });
  return { proposed: true };
}

async function executeReservePlot(worldId: string, npcId: string, args: any) {
  const ttl = Math.min(args.durationSec || 300, 300);
  const success = await redisService.reservePlot(worldId, args.plotId, npcId, ttl);
  return { reserved: success };
}

async function executeReleasePlot(worldId: string, _npcId: string, args: any) {
  await redisService.releasePlot(worldId, args.plotId);
  return { released: true };
}
