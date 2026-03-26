/**
 * Gateway — Unified Express server for dev and Cloud Run.
 * Routes to world-api and npc-orchestrator, proxies Vite in dev.
 */
import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenAI, Type } from '@google/genai';
import { CONFIG } from '../../shared/schemas';
import * as firestore from '../../shared/firestoreService';
import { initRedis } from '../../shared/redisService';
import { initScheduler, startSchedulerLoop } from '../npc-orchestrator/scheduler';
import worldApiRoutes from '../world-api/routes';

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = parseInt(process.env.PORT || '3000', 10);
const SECRET_NAME = `projects/${CONFIG.GCP_PROJECT}/secrets/GEMINI_API_KEY/versions/latest`;

let geminiApiKey = '';
let ai: GoogleGenAI;

// ── Secret Manager bootstrap ────────────────────────────────────
async function loadApiKey(): Promise<string> {
  try {
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({ name: SECRET_NAME });
    const key = version.payload?.data?.toString() || '';
    if (key) {
      console.log('✅ Loaded GEMINI_API_KEY from Secret Manager');
      return key;
    }
  } catch (err: any) {
    console.warn('⚠️  Secret Manager unavailable, falling back to env var:', err.message);
  }
  const envKey = process.env.GEMINI_API_KEY || '';
  if (envKey) {
    console.log('✅ Loaded GEMINI_API_KEY from environment variable');
    return envKey;
  }
  console.error('❌ No GEMINI_API_KEY found!');
  return '';
}

// ── Prompt helpers (for backward-compatible chat/npc endpoints) ──
const CHAT_SYSTEM_PROMPT = (npcName: string | undefined, cubesCount: number) =>
  `You are ${npcName ? npcName : '"Voxel Buddy"'}, a friendly AI assistant for a kids' 3D building game.
The game has textures: dirt, grass, glass, wood, log, stone, water.
Shapes: cube, sphere, pyramid, cylinder, tree, rock, bush, flower, lamp, fence.
Scales: 0.5 (small), 1.0 (medium), 2.0 (large), 3.0 (huge).
The user currently has ${cubesCount} blocks placed.
Keep your tone encouraging, simple, and fun for kids.`;

const NPC_DECISION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    decision: { type: Type.STRING, enum: ['build', 'move', 'chill', 'recruit', 'gift', 'terraform'] },
    thought: { type: Type.STRING },
    buildInstructions: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
        texture: { type: Type.STRING }, shape: { type: Type.STRING }, scale: { type: Type.NUMBER }, color: { type: Type.STRING },
      }, required: ['x', 'y', 'z', 'texture'] },
    },
    newPosition: { type: Type.ARRAY, items: { type: Type.NUMBER } },
    newFriend: { type: Type.OBJECT, properties: {
      name: { type: Type.STRING }, color: { type: Type.STRING }, role: { type: Type.STRING },
      style: { type: Type.STRING }, clothingColor: { type: Type.STRING }, hairColor: { type: Type.STRING },
    }, required: ['name', 'color', 'role'] },
    giftInfo: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, recipient: { type: Type.STRING } } },
  },
  required: ['decision', 'thought'],
} as const;

const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
    buildInstructions: {
      type: Type.ARRAY,
      items: { type: Type.OBJECT, properties: {
        x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
        texture: { type: Type.STRING }, shape: { type: Type.STRING }, scale: { type: Type.NUMBER },
        rotation: { type: Type.ARRAY, items: { type: Type.NUMBER } }, color: { type: Type.STRING },
      }, required: ['x', 'y', 'z', 'texture'] },
    },
  },
  required: ['text'],
} as const;

// ── Retry helper ────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn(); } catch (e: any) {
      lastError = e;
      const isRateLimit = e?.message?.includes('429') || e?.status === 'RESOURCE_EXHAUSTED';
      if (isRateLimit && i < maxRetries - 1) {
        await sleep(Math.pow(2, i) * 5000 + Math.random() * 2000);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

// ── Mount world-api routes ──────────────────────────────────────
app.use('/api', worldApiRoutes);

// ── Legacy chat/NPC routes (backward compat with frontend) ──────

app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, cubesCount, npcName } = req.body;
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: prompt,
      config: { systemInstruction: CHAT_SYSTEM_PROMPT(npcName, cubesCount || 0), responseMimeType: 'application/json', responseSchema: CHAT_RESPONSE_SCHEMA },
    }));
    res.json(JSON.parse(response.text || '{}'));
  } catch (e: any) {
    console.error('POST /api/chat error:', e);
    res.status(500).json({ text: "I'm having a little trouble right now, but let's keep building!" });
  }
});

app.post('/api/npc-decision', async (req, res) => {
  try {
    const { npcName, cubesCount } = req.body;
    const prompt = `You are ${npcName}, an autonomous NPC in a voxel building game. Decide what to do next. Current blocks: ${cubesCount || 0}. Return JSON.`;
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-lite-preview',
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: NPC_DECISION_SCHEMA },
    }), 5);
    res.json(JSON.parse(response.text || '{}'));
  } catch (e: any) {
    console.error('POST /api/npc-decision error:', e);
    res.json({ decision: 'chill', thought: "Just taking a break." });
  }
});

app.post('/api/analyze-photo', async (req, res) => {
  try {
    const { imageData, mimeType } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      contents: [{ parts: [
        { text: "Analyze this person's appearance and suggest a voxel avatar style. Return JSON with: color, clothingColor, hairColor, style." },
        { inlineData: { data: imageData, mimeType } },
      ]}],
      config: { responseMimeType: 'application/json' },
    });
    res.json(JSON.parse(response.text!));
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to analyze photo' });
  }
});

app.get('/api/config', (_req, res) => {
  if (!geminiApiKey) return res.status(503).json({ error: 'API key not loaded' });
  res.json({ apiKey: geminiApiKey });
});

// ── Bootstrap ───────────────────────────────────────────────────
async function start() {
  geminiApiKey = await loadApiKey();
  ai = new GoogleGenAI({ apiKey: geminiApiKey });

  // Initialize Redis (graceful fallback)
  initRedis();

  // Initialize NPC scheduler
  initScheduler(geminiApiKey);
  startSchedulerLoop(CONFIG.DEFAULT_WORLD_ID);

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // In dev, mount Vite middleware for hot reloading
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    // In production, serve the static build from dist/
    const path = await import('path');
    app.use(express.static(path.resolve('dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve('dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Voxel Kids server running at http://localhost:${PORT} (${isDev ? 'dev' : 'production'})`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
