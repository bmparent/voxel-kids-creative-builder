/**
 * NPC Store — owns NPC state, thinking status, and messages.
 */
import { create } from 'zustand';
import { nanoid } from 'nanoid';

export interface NPCData {
  id: string;
  pos: [number, number, number];
  name: string;
  color: string;
  style?: string;
  clothingColor?: string;
  hairColor?: string;
  isThinking?: boolean;
  currentTask?: string;
  currentMessage?: string;
  thoughtHistory?: { timestamp: number; thought: string; decision: string }[];
}

interface NPCState {
  npcs: NPCData[];

  addNPC: (x: number, y: number, z: number, name: string, color: string, style?: string, clothingColor?: string, hairColor?: string) => void;
  updateNPC: (id: string, data: Partial<NPCData>) => void;
  setNPCs: (npcs: NPCData[]) => void;
  setNPCThinking: (id: string, isThinking: boolean, task?: string) => void;
  setNPCMessage: (id: string, message: string | null) => void;
  addNPCThought: (id: string, thought: string, decision: string) => void;
}

export const useNPCStore = create<NPCState>((set) => ({
  npcs: [
    { id: 'npc-1', pos: [5, 0, 5], name: 'Builder Bob', color: '#ffcc00', style: 'worker', clothingColor: '#f97316', hairColor: '#1a1a1a' },
    { id: 'npc-2', pos: [-5, 0, -5], name: 'Creative Cathy', color: '#ff66cc', style: 'artist', clothingColor: '#8b5cf6', hairColor: '#fbbf24' },
  ],

  addNPC: (x, y, z, name, color, style, clothingColor, hairColor) => set((state) => ({
    npcs: [...state.npcs, { id: nanoid(), pos: [x, y, z], name, color, style, clothingColor, hairColor }],
  })),

  updateNPC: (id, data) => set((state) => ({
    npcs: state.npcs.map(npc => npc.id === id ? { ...npc, ...data } : npc),
  })),

  setNPCs: (npcs) => set({ npcs }),

  setNPCThinking: (id, isThinking, task) => set((state) => ({
    npcs: state.npcs.map(npc => npc.id === id ? { ...npc, isThinking, currentTask: task } : npc),
  })),

  setNPCMessage: (id, message) => set((state) => ({
    npcs: state.npcs.map(npc => npc.id === id ? { ...npc, currentMessage: message || undefined } : npc),
  })),

  addNPCThought: (id, thought, decision) => set((state) => ({
    npcs: state.npcs.map(npc => {
      if (npc.id !== id) return npc;
      const newThought = { timestamp: Date.now(), thought, decision };
      const thoughtHistory = [...(npc.thoughtHistory || []), newThought].slice(-10);
      return { ...npc, thoughtHistory };
    }),
  })),
}));
