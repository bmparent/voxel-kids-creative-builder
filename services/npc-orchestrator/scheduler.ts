/**
 * NPC Thinker Scheduler — manages the NPC cognition loop.
 * Enforces max concurrent thinkers, priority, and cooldowns per Mission §11.
 */
import { GoogleGenAI } from '@google/genai';
import { CONFIG, NPCDoc } from '../../shared/schemas';
import * as firestore from '../../shared/firestoreService';
import { redisService } from '../../shared/redisService';
import { routeModel } from './modelRouter';
import { getToolsForRole } from './toolSchemas';
import { executeToolCall } from './toolExecutor';

let ai: GoogleGenAI;
let schedulerInterval: NodeJS.Timeout | null = null;

export function initScheduler(apiKey: string) {
  ai = new GoogleGenAI({ apiKey });
  console.log('✅ NPC Thinker Scheduler initialized');
}

export function startSchedulerLoop(worldId: string) {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(() => runThinkerCycle(worldId), CONFIG.THINKER_INTERVAL_MS);
  console.log(`🧠 Thinker loop started (every ${CONFIG.THINKER_INTERVAL_MS / 1000}s)`);
}

export function stopSchedulerLoop() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

/** One cycle of the thinker loop. */
async function runThinkerCycle(worldId: string) {
  try {
    const npcs = await firestore.getNPCs(worldId);
    if (npcs.length === 0) return;

    // 1. Compute priority scores
    const scored = await Promise.all(
      npcs.map(async (npc) => {
        const onCooldown = await redisService.isOnCooldown(worldId, npc.id);
        const priority = onCooldown ? -1 : computePriority(npc);
        return { npc, priority };
      })
    );

    // 2. Sort by priority, filter out cooldown/inactive
    const eligible = scored
      .filter(s => s.priority > 0)
      .sort((a, b) => b.priority - a.priority);

    // 3. Check concurrent thinker cap
    const activeCount = await redisService.getActiveThinkerCount(worldId);
    const available = Math.max(0, CONFIG.MAX_CONCURRENT_THINKERS - activeCount);
    const batch = eligible.slice(0, available);

    // 4. Run thinking for each selected NPC
    for (const { npc } of batch) {
      // Fire-and-forget (don't block the cycle for other NPCs)
      runNPCThink(worldId, npc).catch(err => {
        console.error(`NPC ${npc.name} think error:`, err.message);
      });
    }
  } catch (err: any) {
    console.error('Thinker cycle error:', err.message);
  }
}

/**
 * Priority scoring per Mission §11:
 * - Near player: +5
 * - Engaged in project: +3
 * - District event active: +2
 * - High relationship importance: +1–3
 * - Base: thinkerPriority from NPC doc
 */
function computePriority(npc: NPCDoc & { id: string }): number {
  let score = npc.thinkerPriority || 1;

  // Boost if actively on a project
  if (npc.activeProjectId) score += 3;

  // Boost based on current activity (rough heuristic)
  if (npc.currentActivity === 'building' || npc.currentActivity === 'decorating') score += 2;

  // Time since last thought — boost NPCs that haven't thought in a while
  const msSinceThought = Date.now() - (npc.lastThoughtAt || 0);
  if (msSinceThought > 120000) score += 2; // >2 minutes

  return score;
}

/** Full NPC think cycle: Layer B (perception) → C (intent) → D (action). */
async function runNPCThink(worldId: string, npc: NPCDoc & { id: string }) {
  // Acquire lock
  const acquired = await redisService.acquireThinkerLock(worldId, npc.id);
  if (!acquired) return;

  try {
    // Update NPC state
    await firestore.upsertNPC(worldId, npc.id, {
      lastThoughtAt: Date.now(),
      currentActivity: 'thinking',
    } as any);

    // ── Layer B: Perception Summary ──
    const perception = await buildPerceptionSummary(worldId, npc);

    // ── Layer C: Intent Planning (Flash-Lite) ──
    const intentModel = routeModel('intent_planning');
    const intentResponse = await ai.models.generateContent({
      model: intentModel.model,
      contents: buildIntentPrompt(npc, perception),
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: intentModel.maxOutputTokens,
      },
    });

    let intent: any;
    try {
      intent = JSON.parse(intentResponse.text || '{}');
    } catch {
      intent = { action: 'chill', reason: 'Could not parse intent' };
    }

    // If the NPC decided to chill, set cooldown and return
    if (intent.action === 'chill' || intent.action === 'rest' || intent.action === 'idle') {
      await firestore.upsertNPC(worldId, npc.id, { currentActivity: 'idle' } as any);
      await redisService.setCooldown(worldId, npc.id, CONFIG.NPC_COOLDOWN_MS / 1000);
      return;
    }

    // ── Layer D: Action Compilation (Flash with tools) ──
    const tools = getToolsForRole(npc.role);
    const actionModel = routeModel('action_compilation');

    const actionResponse = await ai.models.generateContent({
      model: actionModel.model,
      contents: buildActionPrompt(npc, perception, intent),
      config: {
        maxOutputTokens: actionModel.maxOutputTokens,
        tools: [{ functionDeclarations: tools }],
        toolConfig: { functionCallingConfig: { mode: 'AUTO' as any } },
      },
    });

    // Execute any function calls from the response
    const parts = actionResponse.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.functionCall) {
        await executeToolCall(worldId, npc.id, part.functionCall.name!, part.functionCall.args || {});
      }
    }

    // Update NPC state post-action
    await firestore.upsertNPC(worldId, npc.id, {
      currentActivity: intent.action || 'idle',
      lastActedAt: Date.now(),
    } as any);

    // Set cooldown
    await redisService.setCooldown(worldId, npc.id, CONFIG.NPC_COOLDOWN_MS / 1000);

  } finally {
    await redisService.releaseThinkerLock(worldId, npc.id);
  }
}

/** Layer B: Build a compact perception summary (never full world). */
async function buildPerceptionSummary(worldId: string, npc: NPCDoc & { id: string }): Promise<string> {
  // Get nearby voxels within a 16-block radius
  const allVoxels = await firestore.getAllVoxels(worldId);
  const [nx, , nz] = npc.pos;
  const nearbyVoxels = allVoxels.filter(v => {
    const dx = v.pos[0] - nx;
    const dz = v.pos[2] - nz;
    return Math.sqrt(dx * dx + dz * dz) <= 16;
  });

  // Get nearby NPCs
  const allNPCs = await firestore.getNPCs(worldId);
  const nearbyNPCs = allNPCs.filter(n => {
    if (n.id === npc.id) return false;
    const dx = n.pos[0] - nx;
    const dz = n.pos[2] - nz;
    return Math.sqrt(dx * dx + dz * dz) <= 24;
  });

  // Get recent memories
  const memories = await firestore.getRecentMemories(worldId, npc.id, 3);

  return JSON.stringify({
    position: npc.pos,
    nearbyBlocks: nearbyVoxels.length,
    blockSummary: summarizeBlocks(nearbyVoxels),
    nearbyNPCs: nearbyNPCs.map(n => ({ name: n.name, role: n.role, activity: n.currentActivity })),
    recentMemories: memories.map(m => m.summary),
    budget: {
      voxelsRemaining: npc.creativeBudget?.hourly?.voxelsPlaced - (npc.creativeBudget?.used?.voxelsPlaced || 0),
      propsRemaining: npc.creativeBudget?.hourly?.propsSpawned - (npc.creativeBudget?.used?.propsSpawned || 0),
    },
  });
}

/** Summarize blocks by texture/shape count. */
function summarizeBlocks(voxels: any[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const v of voxels) {
    const key = `${v.texture}_${v.shape || 'cube'}`;
    summary[key] = (summary[key] || 0) + 1;
  }
  return summary;
}

/** Build the intent planning prompt. */
function buildIntentPrompt(npc: NPCDoc & { id: string }, perception: string): string {
  return `You are ${npc.name}, a ${npc.role} NPC in a voxel building game.
Your traits: ${npc.traits?.join(', ') || 'friendly'}.
Your current situation: ${perception}

What should you do next? Choose from: build, decorate, socialize, repair, explore, rest, propose_project.
Return a JSON object with: { "action": "...", "reason": "...", "target": "..." }`;
}

/** Build the action compilation prompt. */
function buildActionPrompt(npc: NPCDoc & { id: string }, perception: string, intent: any): string {
  return `You are ${npc.name}, a ${npc.role} NPC in a voxel building game.
Your traits: ${npc.traits?.join(', ') || 'friendly'}.
Your perception: ${perception}
Your intent: ${JSON.stringify(intent)}

Execute your intent by calling the appropriate tools. Use the available functions.
Keep actions small and tasteful. Stay within your role's permissions.
You have a limited creative budget — don't waste it.`;
}
