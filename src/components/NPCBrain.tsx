import { useEffect, useRef } from 'react';
import { useStore } from '../hooks/useStore';
import { getNPCAutonomousDecision } from '../services/geminiService';

export const NPCBrain = () => {
  const npcs = useStore((state) => state.npcs);
  const cubesCount = useStore((state) => state.cubes.length);
  const setNPCThinking = useStore((state) => state.setNPCThinking);
  const setNPCMessage = useStore((state) => state.setNPCMessage);
  const updateNPC = useStore((state) => state.updateNPC);
  const bulkAddCubes = useStore((state) => state.bulkAddCubes);
  const addNPC = useStore((state) => state.addNPC);
  const addNPCThought = useStore((state) => state.addNPCThought);
  
  const lastDecisionTime = useRef<Record<string, number>>({});
  const isGlobalThinking = useRef(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      // Pick a random NPC to think
      const availableNPCs = npcs.filter(npc => !npc.isThinking);
      if (availableNPCs.length === 0 || isGlobalThinking.current) return;

      const npc = availableNPCs[Math.floor(Math.random() * availableNPCs.length)];
      const now = Date.now();
      
      // Only think every 45-90 seconds per NPC to stay within rate limits
      if (lastDecisionTime.current[npc.id] && now - lastDecisionTime.current[npc.id] < 45000) return;

      isGlobalThinking.current = true;
      setNPCThinking(npc.id, true, "Thinking...");
      lastDecisionTime.current[npc.id] = now;

      // Safety timeout to reset global thinking state after 30 seconds
      const safetyTimeout = setTimeout(() => {
        if (isGlobalThinking.current) {
          console.warn(`NPC ${npc.name} thinking state was stuck, resetting...`);
          isGlobalThinking.current = false;
          setNPCThinking(npc.id, false);
        }
      }, 30000);

      try {
        const result = await getNPCAutonomousDecision(npc.name, cubesCount);
        addNPCThought(npc.id, result.thought, result.decision);
        
        if (result.decision === 'build' && result.buildInstructions) {
          setNPCThinking(npc.id, true, `Building: ${result.thought}`);
          // Simulate building time
          setTimeout(() => {
            bulkAddCubes(result.buildInstructions);
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 5000);
        } else if (result.decision === 'terraform' && result.buildInstructions) {
          setNPCThinking(npc.id, true, `Terraforming: ${result.thought}`);
          setTimeout(() => {
            bulkAddCubes(result.buildInstructions);
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 5000);
        } else if (result.decision === 'move' && result.newPosition) {
          setNPCThinking(npc.id, true, `Moving: ${result.thought}`);
          setTimeout(() => {
            updateNPC(npc.id, { pos: result.newPosition as [number, number, number] });
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 3000);
        } else if (result.decision === 'recruit' && result.newFriend) {
          const roleText = result.newFriend.role === 'helper' ? "a helper for you" : "a new friend";
          setNPCThinking(npc.id, true, `Recruiting ${roleText}: ${result.thought}`);
          setTimeout(() => {
            const [nx, ny, nz] = npc.pos;
            addNPC(
              nx + (Math.random() - 0.5) * 8, 
              ny, 
              nz + (Math.random() - 0.5) * 8, 
              result.newFriend.name, 
              result.newFriend.color,
              result.newFriend.style,
              result.newFriend.clothingColor,
              result.newFriend.hairColor
            );
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 4000);
        } else if (result.decision === 'gift' && result.giftInfo) {
          setNPCThinking(npc.id, true, `Gifting ${result.giftInfo.recipient}: ${result.thought}`);
          setTimeout(() => {
            // Visual effect for gifting
            setNPCMessage(npc.id, `Hey ${result.giftInfo.recipient}! I have a ${result.giftInfo.type} for you! 🎁`);
            setTimeout(() => setNPCMessage(npc.id, null), 4000);
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 3000);
        } else {
          setNPCThinking(npc.id, true, `Chilling: ${result.thought}`);
          setTimeout(() => {
            setNPCThinking(npc.id, false);
            isGlobalThinking.current = false;
            clearTimeout(safetyTimeout);
          }, 5000);
        }
      } catch (error) {
        console.error(`NPC ${npc.name} failed to think:`, error);
        setNPCThinking(npc.id, false);
        isGlobalThinking.current = false;
        clearTimeout(safetyTimeout);
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [npcs, cubesCount, setNPCThinking, updateNPC, bulkAddCubes]);

  return null; // This is a logic-only component
};
