/**
 * Network Sync — loads world state from the server and persists changes.
 * Replaces localStorage persistence with Firestore-backed world-api.
 */
import { useEffect, useRef } from 'react';
import { useWorldStore } from '../stores/worldStore';
import { useNPCStore } from '../stores/npcStore';

const WORLD_ID = 'world-default';
const AUTOSAVE_INTERVAL = 30000; // 30 seconds

/** React hook to initialize world sync. Call once in App. */
export function useNetworkSync() {
  const setCubes = useWorldStore(state => state.setCubes);
  const setNPCs = useNPCStore(state => state.setNPCs);
  const initialized = useRef(false);

  // Load world from server on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function loadWorld() {
      try {
        const res = await fetch(`/api/world/${WORLD_ID}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.voxels && data.voxels.length > 0) {
          setCubes(data.voxels.map((v: any) => ({
            id: v.id,
            pos: v.pos,
            texture: v.texture,
            shape: v.shape || 'cube',
            scale: v.scale || 1,
            rotation: v.rotation,
            color: v.color,
          })));
          console.log(`✅ Loaded ${data.voxels.length} blocks from server`);
        }

        if (data.npcs && data.npcs.length > 0) {
          setNPCs(data.npcs.map((n: any) => ({
            id: n.id,
            pos: n.pos,
            name: n.name,
            color: n.color,
            style: n.style,
            clothingColor: n.clothingColor,
            hairColor: n.hairColor,
          })));
          console.log(`✅ Loaded ${data.npcs.length} NPCs from server`);
        }
      } catch (err) {
        console.warn('⚠️  Could not load world from server, using local state:', err);
        // Fall back to whatever is already in the stores (default initial state)
      }
    }

    loadWorld();
  }, [setCubes, setNPCs]);

  // Autosave: sync local cubes to server periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      const cubes = useWorldStore.getState().cubes;
      if (cubes.length === 0) return;

      try {
        await fetch(`/api/world/${WORLD_ID}/actions/place`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worldId: WORLD_ID,
            sourceType: 'player',
            sourceId: 'player-1',
            voxels: cubes.map(c => ({
              x: c.pos[0], y: c.pos[1], z: c.pos[2],
              texture: c.texture,
              shape: c.shape,
              scale: c.scale,
              rotation: c.rotation,
              color: c.color,
            })),
          }),
        });
      } catch {
        // Non-critical — will retry next interval
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, []);
}

/** Manual save function for the save button */
export async function saveWorldToServer() {
  const cubes = useWorldStore.getState().cubes;
  try {
    await fetch(`/api/world/${WORLD_ID}/actions/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        worldId: WORLD_ID,
        sourceType: 'player',
        sourceId: 'player-1',
        voxels: cubes.map(c => ({
          x: c.pos[0], y: c.pos[1], z: c.pos[2],
          texture: c.texture, shape: c.shape, scale: c.scale,
          rotation: c.rotation, color: c.color,
        })),
      }),
    });

    // Also trigger a GCS snapshot
    await fetch(`/api/world/${WORLD_ID}/snapshot`, { method: 'POST' });
    console.log('✅ World saved and snapshot created');
  } catch (err) {
    console.error('Failed to save world:', err);
  }
}
