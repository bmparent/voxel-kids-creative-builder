/**
 * Cloud Storage service — world snapshots, chunk blobs, artifacts.
 */
import { Storage } from '@google-cloud/storage';
import { CONFIG, ChunkPayload } from './schemas';

const storage = new Storage({ projectId: CONFIG.GCP_PROJECT });
const bucket = storage.bucket(CONFIG.GCS_BUCKET);

export const storageService = {
  async uploadChunk(path: string, payload: ChunkPayload): Promise<void> {
    const file = bucket.file(path);
    await file.save(JSON.stringify(payload), {
      contentType: 'application/json',
      gzip: true,
    });
  },

  async downloadChunk(path: string): Promise<ChunkPayload | null> {
    try {
      const file = bucket.file(path);
      const [contents] = await file.download();
      return JSON.parse(contents.toString()) as ChunkPayload;
    } catch (err: any) {
      if (err.code === 404) return null;
      throw err;
    }
  },

  async saveSnapshot(worldId: string, data: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = `worlds/${worldId}/snapshots/snapshot-${timestamp}.json`;
    const file = bucket.file(path);
    await file.save(JSON.stringify(data), {
      contentType: 'application/json',
      gzip: true,
    });
    return path;
  },

  async getSignedUrl(path: string, action: 'read' | 'write' = 'read', expiresInMinutes = 15): Promise<string> {
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
      action,
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });
    return url;
  },
};
