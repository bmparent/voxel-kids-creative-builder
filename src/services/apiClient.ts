/**
 * Frontend API client — calls the Express backend proxy instead of Gemini directly.
 */

export interface BuildInstruction {
  x: number;
  y: number;
  z: number;
  texture: string;
  shape?: string;
  scale?: number;
  rotation?: [number, number, number];
  color?: string;
}

export const getAIResponse = async (
  prompt: string,
  currentCubesCount: number,
  npcName?: string
): Promise<{ text: string; buildInstructions?: BuildInstruction[] }> => {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, cubesCount: currentCubesCount, npcName }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('API chat error:', e);
    return { text: "I'm having a little trouble thinking right now, but let's keep building!" };
  }
};

export const getNPCAutonomousDecision = async (
  npcName: string,
  currentCubesCount: number
): Promise<any> => {
  try {
    const res = await fetch('/api/npc-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcName, cubesCount: currentCubesCount }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('API npc-decision error:', e);
    return { decision: 'chill', thought: "I'm just taking a break." };
  }
};

export const analyzePhoto = async (
  imageData: string,
  mimeType: string
): Promise<{ color: string; clothingColor: string; hairColor: string; style: string }> => {
  const res = await fetch('/api/analyze-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageData, mimeType }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
};

export const getGeminiApiKey = async (): Promise<string> => {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.apiKey || '';
  } catch (e) {
    console.error('Failed to fetch API config:', e);
    return '';
  }
};
