/**
 * Model router — selects the right Gemini model tier based on task type.
 * Implements the Mission §6 routing rules.
 */

export type ModelTier = 'flash-lite' | 'flash' | 'pro';

export interface ModelConfig {
  model: string;
  tier: ModelTier;
  maxOutputTokens: number;
}

const MODELS: Record<ModelTier, ModelConfig> = {
  'flash-lite': {
    model: 'gemini-2.5-flash-lite-preview',
    tier: 'flash-lite',
    maxOutputTokens: 1024,
  },
  'flash': {
    model: 'gemini-2.5-flash-preview',
    tier: 'flash',
    maxOutputTokens: 4096,
  },
  'pro': {
    model: 'gemini-2.5-pro-preview',
    tier: 'pro',
    maxOutputTokens: 8192,
  },
};

export type TaskCategory =
  | 'intent_planning'       // What should I do next?
  | 'local_summary'         // Summarize my surroundings
  | 'simple_decor'          // Place a flower or bench
  | 'short_speech'          // Say something short
  | 'action_compilation'    // Compile a build plan
  | 'build_assist'          // Player-facing creative help
  | 'project_proposal'      // Propose a project
  | 'multi_tool_sequence'   // Complex multi-step action
  | 'district_redesign'     // Redesign a district
  | 'town_planning'         // Multi-NPC coordination
  | 'blueprint_generation'  // Complex blueprint
  | 'world_curation';       // Offline world improvement

/**
 * Route to the appropriate model based on task category.
 * 
 * Flash-Lite: frequent, low-stakes decisions
 * Flash: medium-complexity, player-facing
 * Pro: rare, district-scale, complex planning (never in fast loop)
 */
export function routeModel(category: TaskCategory): ModelConfig {
  switch (category) {
    // Flash-Lite tier
    case 'intent_planning':
    case 'local_summary':
    case 'simple_decor':
    case 'short_speech':
      return MODELS['flash-lite'];

    // Flash tier
    case 'action_compilation':
    case 'build_assist':
    case 'project_proposal':
    case 'multi_tool_sequence':
      return MODELS['flash'];

    // Pro tier (rare, never in fast loop)
    case 'district_redesign':
    case 'town_planning':
    case 'blueprint_generation':
    case 'world_curation':
      return MODELS['pro'];

    default:
      return MODELS['flash-lite'];
  }
}

/** Check if a model tier is allowed in the per-second game loop. Pro is never allowed. */
export function isAllowedInFastLoop(tier: ModelTier): boolean {
  return tier !== 'pro';
}
