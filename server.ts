/**
 * Express backend proxy for Gemini API calls.
 * Fetches the API key from Google Cloud Secret Manager (or falls back to env var).
 * Proxies Vite dev server in development mode.
 */
import express from 'express';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
app.use(express.json({ limit: '10mb' })); // Allow large payloads for image uploads

const PORT = parseInt(process.env.PORT || '3000', 10);
const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'hive-core-vertex-bmparent';
const SECRET_NAME = `projects/${GCP_PROJECT}/secrets/GEMINI_API_KEY/versions/latest`;

let geminiApiKey = '';
let ai: GoogleGenAI;

// ── Secret Manager bootstrap ────────────────────────────────────
async function loadApiKey(): Promise<string> {
  // 1. Try Secret Manager
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

  // 2. Fallback to env var
  const envKey = process.env.GEMINI_API_KEY || '';
  if (envKey) {
    console.log('✅ Loaded GEMINI_API_KEY from environment variable');
    return envKey;
  }

  console.error('❌ No GEMINI_API_KEY found! AI features will not work.');
  return '';
}

// ── Shared prompt builders (moved from client) ──────────────────

const NPC_SYSTEM_PROMPT = (npcName: string, cubesCount: number) =>
  `You are ${npcName}, an autonomous NPC in a voxel building game.
Decide what you want to do next. You can:
1. "build": Build a small, creative structure.
2. "move": Move to a new location.
3. "chill": Do nothing for a while.
4. "recruit": Invite a new friend for yourself or a helper for the user.
5. "gift": Give a small gift to the user or another NPC (e.g., a flower or a special block).
6. "terraform": Modify the terrain slightly (e.g., create a small hill or a pond).

Current world state: ${cubesCount} blocks placed.

If you decide to build or terraform, provide 5-15 build instructions.
If you decide to move, provide a new [x, y, z] position (y=0).
If you decide to recruit, provide the name and color of your new friend/helper.
If you decide to gift, provide the gift type and recipient.

Return your decision in JSON format.`;

const CHAT_SYSTEM_PROMPT = (npcName: string | undefined, cubesCount: number) =>
  `You are ${npcName ? npcName : '"Voxel Buddy"'}, a friendly AI assistant for a kids' 3D building game. 
Your goal is to inspire creativity and help with the game.
${npcName ? 'You are an NPC in the world, and you love building things with the player!' : ''}
The game has these textures: dirt, grass, glass, wood, log, stone, water.
The game has these shapes: cube, sphere, pyramid, cylinder, tree, rock, bush, flower, lamp, fence.
The game supports scaling (size): 0.5 (small), 1.0 (medium), 2.0 (large), 3.0 (huge).

A 'tree' is a pre-built model with a trunk and leaves.
A 'rock' is a pre-built natural stone model.
A 'bush' is a green leafy sphere.
A 'flower' is a small plant with a red top.
A 'lamp' is a glowing light post.
A 'fence' is a wooden barrier.
'water' is a blue, transparent block that players can swim through.

The user currently has ${cubesCount} blocks placed.

You can:
1. Suggest building ideas (e.g., "How about a tall tower with a glass top?").
2. Explain controls (W/A/S/D to move, Click to build, Alt+Click to remove, Shift to sprint).
3. Provide "Magic Build" instructions in JSON format if the user asks to build something specific.

When building:
- Create complex, multi-block structures (e.g., a castle, a garden, a playground).
- Use varying textures and shapes to make builds interesting.
- The ground is at y=0. Blocks placed at y=0 will sit on the grass.
- You can use 'color' (hex code like '#ff0000') to tint blocks.
- You can use 'rotation' (array [x, y, z] in radians) to rotate blocks.
- Limit your "Magic Build" to about 20-30 blocks to keep it fast!

Keep your tone encouraging, simple, and fun for kids.`;

// ── Retry helper ────────────────────────────────────────────────
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errorString = JSON.stringify(error);
      const isRateLimit =
        errorString.includes('429') ||
        errorString.includes('RESOURCE_EXHAUSTED') ||
        error?.message?.includes('429') ||
        error?.status === 'RESOURCE_EXHAUSTED' ||
        error?.code === 429 ||
        error?.error?.code === 429 ||
        error?.error?.status === 'RESOURCE_EXHAUSTED';

      if (isRateLimit && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 5000 + Math.random() * 2000;
        console.warn(`Rate limit hit, retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      console.error(`Gemini API Error (Attempt ${i + 1}):`, error);
      throw error;
    }
  }
  throw lastError;
};

// ── NPC decision schema ─────────────────────────────────────────
const NPC_DECISION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    decision: { type: Type.STRING, enum: ['build', 'move', 'chill', 'recruit', 'gift', 'terraform'] },
    thought: { type: Type.STRING, description: 'A short sentence explaining what you\'re doing.' },
    buildInstructions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
          texture: { type: Type.STRING, enum: ['dirt', 'grass', 'glass', 'wood', 'log', 'stone', 'water'] },
          shape: { type: Type.STRING, enum: ['cube', 'sphere', 'pyramid', 'cylinder', 'tree', 'rock', 'bush', 'flower', 'lamp', 'fence'] },
          scale: { type: Type.NUMBER },
          color: { type: Type.STRING },
        },
        required: ['x', 'y', 'z', 'texture'],
      },
    },
    newPosition: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: '[x, y, z] coordinates.' },
    newFriend: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING }, color: { type: Type.STRING }, style: { type: Type.STRING },
        clothingColor: { type: Type.STRING }, hairColor: { type: Type.STRING },
        role: { type: Type.STRING, enum: ['friend', 'helper'], description: 'Who is this new NPC for?' },
      },
      required: ['name', 'color', 'role'],
    },
    giftInfo: {
      type: Type.OBJECT,
      properties: { type: { type: Type.STRING }, recipient: { type: Type.STRING } },
    },
  },
  required: ['decision', 'thought'],
} as const;

// ── Chat response schema ────────────────────────────────────────
const CHAT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: 'Your friendly message to the user.' },
    buildInstructions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
          texture: { type: Type.STRING, enum: ['dirt', 'grass', 'glass', 'wood', 'log', 'stone', 'water'] },
          shape: { type: Type.STRING, enum: ['cube', 'sphere', 'pyramid', 'cylinder', 'tree', 'rock', 'bush', 'flower', 'lamp', 'fence'] },
          scale: { type: Type.NUMBER, description: 'The size of the block (0.5 to 3.0). Default is 1.0.' },
          rotation: { type: Type.ARRAY, items: { type: Type.NUMBER }, description: 'Rotation [x, y, z] in radians.' },
          color: { type: Type.STRING, description: 'Hex color code to tint the block.' },
        },
        required: ['x', 'y', 'z', 'texture'],
      },
      description: 'Optional list of coordinates, textures, and shapes to build a structure.',
    },
  },
  required: ['text'],
} as const;

// ── API Routes ──────────────────────────────────────────────────

// POST /api/chat — AI chat response
app.post('/api/chat', async (req, res) => {
  try {
    const { prompt, cubesCount, npcName } = req.body;
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: CHAT_SYSTEM_PROMPT(npcName, cubesCount || 0),
        responseMimeType: 'application/json',
        responseSchema: CHAT_RESPONSE_SCHEMA,
      },
    }));
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('POST /api/chat error:', error);
    res.status(500).json({ text: "I'm having a little trouble thinking right now, but let's keep building!" });
  }
});

// POST /api/npc-decision — Autonomous NPC decision
app.post('/api/npc-decision', async (req, res) => {
  try {
    const { npcName, cubesCount } = req.body;
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: NPC_SYSTEM_PROMPT(npcName, cubesCount || 0),
      config: {
        responseMimeType: 'application/json',
        responseSchema: NPC_DECISION_SCHEMA,
      },
    }), 5);
    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('POST /api/npc-decision error:', error);
    res.json({ decision: 'chill', thought: "I'm just taking a break." });
  }
});

// POST /api/analyze-photo — NPC photo restyle via vision
app.post('/api/analyze-photo', async (req, res) => {
  try {
    const { imageData, mimeType } = req.body;
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            { text: "Analyze this person's appearance and suggest a voxel avatar style for an NPC. Return a JSON object with: color (skin tone hex), clothingColor (main outfit hex), hairColor (hair hex), and style (one word description like 'casual', 'formal', 'sporty')." },
            { inlineData: { data: imageData, mimeType } },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            color: { type: Type.STRING },
            clothingColor: { type: Type.STRING },
            hairColor: { type: Type.STRING },
            style: { type: Type.STRING },
          },
          required: ['color', 'clothingColor', 'hairColor', 'style'],
        },
      },
    });
    const parsed = JSON.parse(response.text!);
    res.json(parsed);
  } catch (error: any) {
    console.error('POST /api/analyze-photo error:', error);
    res.status(500).json({ error: 'Failed to analyze photo' });
  }
});

// GET /api/config — Returns the API key for Live Audio (client WebSocket)
app.get('/api/config', (_req, res) => {
  if (!geminiApiKey) {
    return res.status(503).json({ error: 'API key not loaded' });
  }
  res.json({ apiKey: geminiApiKey });
});

// ── Bootstrap ───────────────────────────────────────────────────
async function start() {
  geminiApiKey = await loadApiKey();
  ai = new GoogleGenAI({ apiKey: geminiApiKey });

  // In development, proxy the Vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Voxel Kids server running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
