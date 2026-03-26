/**
 * Redis service — hot locks, cooldowns, reservations.
 * Falls back gracefully when Redis is unavailable (local dev without Redis).
 */
import Redis from 'ioredis';
import { CONFIG } from './schemas';

let redis: Redis | null = null;
let redisAvailable = false;

export function initRedis(): void {
  try {
    redis = new Redis({
      host: CONFIG.REDIS_HOST,
      port: CONFIG.REDIS_PORT,
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️  Redis unavailable — falling back to in-memory locks');
          return null; // Stop retrying
        }
        return Math.min(times * 200, 1000);
      },
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('✅ Connected to Redis');
    });

    redis.on('error', () => {
      redisAvailable = false;
    });
  } catch {
    console.warn('⚠️  Redis init failed — using in-memory fallback');
  }
}

// In-memory fallback for local dev
const memLocks = new Map<string, number>();

export const redisService = {
  /** Acquire a thinker lock for an NPC. Returns true if acquired. */
  async acquireThinkerLock(worldId: string, npcId: string, ttlSec = 30): Promise<boolean> {
    const key = `thinker_lock:${worldId}:${npcId}`;
    if (redisAvailable && redis) {
      const result = await redis.set(key, '1', 'EX', ttlSec, 'NX');
      return result === 'OK';
    }
    // In-memory fallback
    const now = Date.now();
    const existing = memLocks.get(key);
    if (existing && existing > now) return false;
    memLocks.set(key, now + ttlSec * 1000);
    return true;
  },

  async releaseThinkerLock(worldId: string, npcId: string): Promise<void> {
    const key = `thinker_lock:${worldId}:${npcId}`;
    if (redisAvailable && redis) {
      await redis.del(key);
    } else {
      memLocks.delete(key);
    }
  },

  /** Check if NPC is in cooldown. */
  async isOnCooldown(worldId: string, npcId: string): Promise<boolean> {
    const key = `npc_cooldown:${worldId}:${npcId}`;
    if (redisAvailable && redis) {
      return (await redis.exists(key)) === 1;
    }
    const expiry = memLocks.get(key);
    return !!expiry && expiry > Date.now();
  },

  async setCooldown(worldId: string, npcId: string, ttlSec: number): Promise<void> {
    const key = `npc_cooldown:${worldId}:${npcId}`;
    if (redisAvailable && redis) {
      await redis.set(key, '1', 'EX', ttlSec);
    } else {
      memLocks.set(key, Date.now() + ttlSec * 1000);
    }
  },

  /** Reserve a plot for a project. Returns true if acquired. */
  async reservePlot(worldId: string, plotId: string, npcId: string, ttlSec = 300): Promise<boolean> {
    const key = `plot_reservation:${worldId}:${plotId}`;
    if (redisAvailable && redis) {
      const result = await redis.set(key, npcId, 'EX', ttlSec, 'NX');
      return result === 'OK';
    }
    const now = Date.now();
    const existing = memLocks.get(key);
    if (existing && existing > now) return false;
    memLocks.set(key, now + ttlSec * 1000);
    return true;
  },

  async releasePlot(worldId: string, plotId: string): Promise<void> {
    const key = `plot_reservation:${worldId}:${plotId}`;
    if (redisAvailable && redis) {
      await redis.del(key);
    } else {
      memLocks.delete(key);
    }
  },

  /** Track active voice NPCs (max 2). */
  async addVoiceNPC(worldId: string, npcId: string): Promise<boolean> {
    const key = `active_voice_npcs:${worldId}`;
    if (redisAvailable && redis) {
      const count = await redis.scard(key);
      if (count >= CONFIG.MAX_VOICE_NPCS) return false;
      await redis.sadd(key, npcId);
      return true;
    }
    // In-memory fallback
    const set = (memLocks.get(key) as any as Set<string>) || new Set<string>();
    if (set.size >= CONFIG.MAX_VOICE_NPCS) return false;
    set.add(npcId);
    memLocks.set(key, set as any);
    return true;
  },

  async removeVoiceNPC(worldId: string, npcId: string): Promise<void> {
    const key = `active_voice_npcs:${worldId}`;
    if (redisAvailable && redis) {
      await redis.srem(key, npcId);
    } else {
      const set = (memLocks.get(key) as any as Set<string>);
      if (set) set.delete(npcId);
    }
  },

  /** Get count of active thinkers in a world. */
  async getActiveThinkerCount(worldId: string): Promise<number> {
    if (redisAvailable && redis) {
      const keys = await redis.keys(`thinker_lock:${worldId}:*`);
      return keys.length;
    }
    const now = Date.now();
    let count = 0;
    for (const [key, expiry] of memLocks) {
      if (key.startsWith(`thinker_lock:${worldId}:`) && expiry > now) count++;
    }
    return count;
  },
};
