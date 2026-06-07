import { Router, Request, Response } from 'express';
import { IngestionService } from '../services/ingestion.service.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowManagerService } from '../services/window-manager.service.js';

export function createApiRoutes(
  ingestionService: IngestionService,
  windowRepo?: WindowRepository,
  bufferRepo?: BufferRepository,
  windowManager?: WindowManagerService
): Router {
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

      const result = await ingestionService.ingest(req.params.bufferId, apiKey, {
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

  if (windowRepo && bufferRepo && windowManager) {
    router.get('/windows', async (req: Request, res: Response) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        if (!apiKey) {
          res.status(401).json({ error: 'Missing X-Api-Key header' });
          return;
        }
        const bufferId = req.query.bufferId as string;
        if (!bufferId) {
          res.status(400).json({ error: 'Missing query parameter: bufferId' });
          return;
        }

        const buffer = await bufferRepo.findById(bufferId);
        if (!buffer || buffer.api_key !== apiKey) {
          res.status(404).json({ error: 'Buffer not found or invalid API key' });
          return;
        }

        const status = req.query.status as string | undefined;
        const windows = await windowRepo.findByBufferWithLogs(bufferId, status as any);
        res.json({ windows });
      } catch (err) {
        throw err;
      }
    });

    router.post('/confirm/:windowId', async (req: Request, res: Response) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        if (!apiKey) {
          res.status(401).json({ error: 'Missing X-Api-Key header' });
          return;
        }

        const window = await windowRepo.findById(req.params.windowId);
        if (!window) {
          res.status(404).json({ error: 'Window not found' });
          return;
        }

        const buffer = await bufferRepo.findById(window.buffer_id);
        if (!buffer || buffer.api_key !== apiKey) {
          res.status(404).json({ error: 'Buffer not found or invalid API key' });
          return;
        }

        if (window.status !== 'closed') {
          res.status(400).json({
            error: `Window status is '${window.status}', expected 'closed'`,
          });
          return;
        }

        await windowManager.confirmConsumption(window.buffer_id, window.identifier, window.id);
        res.json({ status: 'consumed' });
      } catch (err) {
        throw err;
      }
    });

    router.post('/reset-timer/:bufferId', async (req: Request, res: Response) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        if (!apiKey) {
          res.status(401).json({ error: 'Missing X-Api-Key header' });
          return;
        }

        const buffer = await bufferRepo.findById(req.params.bufferId);
        if (!buffer || buffer.api_key !== apiKey) {
          res.status(404).json({ error: 'Buffer not found or invalid API key' });
          return;
        }

        const { identifier } = req.body;
        if (!identifier) {
          res.status(400).json({ error: 'Missing required field: identifier' });
          return;
        }

        const openWindow = await windowRepo.findOpenByIdentifier(buffer.id, identifier);
        
        if (openWindow) {
          await windowManager.resetWindow(buffer, openWindow.id, identifier);
          const updatedWindow = await windowRepo.findById(openWindow.id);
          
          res.json({
            success: true,
            reset: true,
            message: 'Window timer reset successfully',
            expires_at: updatedWindow?.expires_at
          });
        } else {
          res.json({
            success: true,
            reset: false,
            message: 'No open window found for this identifier',
            expires_at: null
          });
        }
      } catch (err) {
        throw err;
      }
    });
  }

  return router;
}
