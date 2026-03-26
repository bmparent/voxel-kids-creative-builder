/**
 * Gemini service — re-exports from apiClient.
 * All Gemini API calls are now handled server-side by the Express proxy.
 * This file exists for backward compatibility so all existing imports continue to work.
 */
export { getAIResponse, getNPCAutonomousDecision, type BuildInstruction } from './apiClient';
