/**
 * OpenAPI-style tool declarations for Gemini function calling.
 * These define what actions NPCs can propose through the AI planner.
 */
import { Type } from '@google/genai';

// ── Perception Tools ────────────────────────────────────────────
export const PERCEPTION_TOOLS = [
  {
    name: 'get_local_patch',
    description: 'Get a summary of the local area around the NPC, including blocks, props, and terrain within the given radius.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        radius: { type: Type.NUMBER, description: 'Radius in blocks to scan (default 16, max 32)' },
      },
    },
  },
  {
    name: 'get_nearby_entities',
    description: 'Get a list of nearby NPCs, players, and interactive objects.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        radius: { type: Type.NUMBER, description: 'Search radius in blocks' },
      },
    },
  },
  {
    name: 'get_plot_info',
    description: 'Get details about a specific plot including ownership, protection, and constraints.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plotId: { type: Type.STRING, description: 'The plot ID to query' },
      },
      required: ['plotId'],
    },
  },
  {
    name: 'get_open_tasks',
    description: 'Get a list of open tasks or improvement opportunities in the district.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        districtId: { type: Type.STRING, description: 'District to check for tasks' },
      },
    },
  },
];

// ── Action Proposal Tools ───────────────────────────────────────
export const ACTION_TOOLS = [
  {
    name: 'propose_project',
    description: 'Propose a larger building or beautification project for approval.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectType: { type: Type.STRING, enum: ['build', 'beautify', 'repair', 'event', 'terraform'] },
        targetId: { type: Type.STRING, description: 'Target plot or district ID' },
        style: { type: Type.STRING, description: 'Style description (e.g., "whimsical", "rustic")' },
        summary: { type: Type.STRING, description: 'Brief description of the project' },
      },
      required: ['projectType', 'summary'],
    },
  },
  {
    name: 'reserve_plot',
    description: 'Reserve a plot for exclusive editing during a project.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plotId: { type: Type.STRING },
        durationSec: { type: Type.NUMBER, description: 'How long to reserve (max 300 seconds)' },
      },
      required: ['plotId'],
    },
  },
  {
    name: 'release_plot',
    description: 'Release a previously reserved plot.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        plotId: { type: Type.STRING },
      },
      required: ['plotId'],
    },
  },
];

// ── World Editing Tools ─────────────────────────────────────────
export const WORLD_EDITING_TOOLS = [
  {
    name: 'place_prop',
    description: 'Place a decorative prop or structure at a position.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        propType: { type: Type.STRING, enum: ['bench', 'lantern', 'sign', 'barrel', 'crate', 'well', 'fountain'] },
        x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
        rotation: { type: Type.NUMBER, description: 'Y-rotation in degrees' },
        styleTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['propType', 'x', 'y', 'z'],
    },
  },
  {
    name: 'remove_prop',
    description: 'Remove a prop by ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        propId: { type: Type.STRING },
      },
      required: ['propId'],
    },
  },
  {
    name: 'plant_flora',
    description: 'Plant flowers, bushes, or trees at specified positions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        species: { type: Type.STRING, enum: ['flower', 'bush', 'tree', 'grass_patch', 'vine'] },
        positions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
            },
            required: ['x', 'y', 'z'],
          },
        },
        styleTags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['species', 'positions'],
    },
  },
  {
    name: 'paint_region',
    description: 'Change the material/texture of a region of blocks.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        region: {
          type: Type.OBJECT,
          properties: {
            minX: { type: Type.NUMBER }, minZ: { type: Type.NUMBER },
            maxX: { type: Type.NUMBER }, maxZ: { type: Type.NUMBER },
            y: { type: Type.NUMBER },
          },
          required: ['minX', 'minZ', 'maxX', 'maxZ', 'y'],
        },
        material: { type: Type.STRING, enum: ['dirt', 'grass', 'stone', 'wood', 'log'] },
      },
      required: ['region', 'material'],
    },
  },
  {
    name: 'place_voxel_pattern',
    description: 'Place a small pre-compiled pattern of voxels at an anchor point. Max 20 voxels.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        voxels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
              texture: { type: Type.STRING, enum: ['dirt', 'grass', 'glass', 'wood', 'log', 'stone', 'water'] },
              shape: { type: Type.STRING, enum: ['cube', 'sphere', 'pyramid', 'cylinder'] },
              color: { type: Type.STRING },
            },
            required: ['x', 'y', 'z', 'texture'],
          },
          description: 'Array of voxels to place. Maximum 20.',
        },
        anchorX: { type: Type.NUMBER }, anchorY: { type: Type.NUMBER }, anchorZ: { type: Type.NUMBER },
      },
      required: ['voxels', 'anchorX', 'anchorY', 'anchorZ'],
    },
  },
  {
    name: 'create_path',
    description: 'Create a path between points using a specified material.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        points: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: { x: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
            required: ['x', 'z'],
          },
        },
        material: { type: Type.STRING, enum: ['stone', 'wood', 'dirt', 'grass'] },
        width: { type: Type.NUMBER, description: 'Path width in blocks (1-3)' },
      },
      required: ['points', 'material'],
    },
  },
  {
    name: 'set_sign_text',
    description: 'Set text on an existing sign.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        signId: { type: Type.STRING },
        text: { type: Type.STRING, description: 'Text to display (max 50 chars)' },
      },
      required: ['signId', 'text'],
    },
  },
];

// ── Social Tools ────────────────────────────────────────────────
export const SOCIAL_TOOLS = [
  {
    name: 'speak',
    description: 'Say something to nearby entities.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'What to say (max 200 chars)' },
        tone: { type: Type.STRING, enum: ['friendly', 'excited', 'thoughtful', 'concerned', 'playful'] },
      },
      required: ['text'],
    },
  },
  {
    name: 'leave_gift',
    description: 'Leave a small gift for the player or another NPC.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetEntityId: { type: Type.STRING },
        giftType: { type: Type.STRING, enum: ['flower', 'lantern', 'special_block', 'blueprint'] },
        note: { type: Type.STRING, description: 'Optional note with the gift' },
      },
      required: ['targetEntityId', 'giftType'],
    },
  },
  {
    name: 'invite_npc',
    description: 'Invite another NPC to collaborate on an activity.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        targetNpcId: { type: Type.STRING },
        activityType: { type: Type.STRING, enum: ['build_together', 'explore', 'chat', 'decorate'] },
      },
      required: ['targetNpcId', 'activityType'],
    },
  },
];

// ── Memory Tool ─────────────────────────────────────────────────
export const MEMORY_TOOLS = [
  {
    name: 'write_memory',
    description: 'Store an important observation or experience for future reference.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memoryType: { type: Type.STRING, enum: ['observation', 'interaction', 'achievement', 'preference', 'relationship'] },
        summary: { type: Type.STRING, description: 'What to remember' },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        importance: { type: Type.NUMBER, description: 'How important (1-10)' },
      },
      required: ['memoryType', 'summary', 'importance'],
    },
  },
];

// ── Role-based tool access ──────────────────────────────────────
export function getToolsForRole(role: string): any[] {
  const base = [...PERCEPTION_TOOLS, ...SOCIAL_TOOLS, ...MEMORY_TOOLS];

  switch (role) {
    case 'gardener':
      return [...base,
        ...WORLD_EDITING_TOOLS.filter(t => ['plant_flora', 'place_prop', 'place_voxel_pattern'].includes(t.name)),
        ...ACTION_TOOLS.filter(t => ['reserve_plot', 'release_plot'].includes(t.name)),
      ];
    case 'builder':
      return [...base,
        ...WORLD_EDITING_TOOLS.filter(t => ['place_voxel_pattern', 'create_path', 'paint_region', 'place_prop', 'remove_prop'].includes(t.name)),
        ...ACTION_TOOLS,
      ];
    case 'shopkeeper':
      return [...base,
        ...WORLD_EDITING_TOOLS.filter(t => ['place_prop', 'set_sign_text'].includes(t.name)),
      ];
    case 'mayor':
      return [...base, ...ACTION_TOOLS];
    case 'artist':
      return [...base,
        ...WORLD_EDITING_TOOLS.filter(t => ['place_voxel_pattern', 'paint_region', 'plant_flora', 'place_prop'].includes(t.name)),
        ...ACTION_TOOLS.filter(t => ['propose_project', 'reserve_plot', 'release_plot'].includes(t.name)),
      ];
    default:
      return [...base,
        ...WORLD_EDITING_TOOLS.filter(t => ['place_prop', 'plant_flora'].includes(t.name)),
      ];
  }
}

/** All tools flattened for reference */
export const ALL_TOOLS = [
  ...PERCEPTION_TOOLS,
  ...ACTION_TOOLS,
  ...WORLD_EDITING_TOOLS,
  ...SOCIAL_TOOLS,
  ...MEMORY_TOOLS,
];
