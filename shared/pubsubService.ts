/**
 * Pub/Sub service — publish world events for decoupled consumers.
 */
import { PubSub } from '@google-cloud/pubsub';
import { CONFIG, WorldDiff, WorldEventDoc } from './schemas';

const pubsub = new PubSub({ projectId: CONFIG.GCP_PROJECT });
const topic = pubsub.topic(CONFIG.PUBSUB_TOPIC);

export const pubsubService = {
  async publishWorldChanged(diff: WorldDiff): Promise<string> {
    const messageId = await topic.publishMessage({
      json: { type: 'world.changed', data: diff },
      attributes: {
        worldId: diff.worldId,
        revision: diff.revision.toString(),
        eventType: 'world.changed',
      },
    });
    return messageId;
  },

  async publishEvent(event: WorldEventDoc & { worldId: string }): Promise<string> {
    const messageId = await topic.publishMessage({
      json: { type: event.type, data: event },
      attributes: {
        worldId: event.worldId,
        eventType: event.type,
      },
    });
    return messageId;
  },

  async publishNPCAction(worldId: string, npcId: string, action: string, payload: any): Promise<string> {
    const messageId = await topic.publishMessage({
      json: { type: 'npc.action', data: { worldId, npcId, action, payload } },
      attributes: {
        worldId,
        npcId,
        eventType: 'npc.action',
      },
    });
    return messageId;
  },
};
