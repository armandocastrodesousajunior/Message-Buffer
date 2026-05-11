import { Router, Request, Response } from 'express';
import { IngestionService } from '../services/ingestion.service.js';

export function createApiRoutes(ingestionService: IngestionService): Router {
  const router = Router();

  router.post('/ingest/:bufferId', async (req: Request, res: Response) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      if (!apiKey) {
        res.status(401).json({ error: 'Missing X-Api-Key header' });
        return;
      }

      const { identifier, content, type } = req.body;

      if (!identifier || content === undefined || !type) {
        res.status(400).json({
          error: 'Missing required fields: identifier, content, type',
        });
        return;
      }

      if (!['string', 'number', 'boolean', 'json'].includes(type)) {
        res.status(400).json({
          error: 'Invalid type. Must be one of: string, number, boolean, json',
        });
        return;
      }

      const result = await ingestionService. ingest(req.params.bufferId, apiKey, {
        identifier,
        content,
        type,
      });

      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message === 'BUFFER_NOT_FOUND') {
        res.status(404).json({ error: 'Buffer not found or invalid API key' });
        return;
      }
      throw err;
    }
  });

  return router;
}
