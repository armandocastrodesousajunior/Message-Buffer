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
      
      const { env } = await import('../config/env.js');
      const isGlobalAdmin = apiKey === env.accessToken;

      const { identifier, content, type, upsert } = req.body;

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

      let buffer = bufferRepo ? await bufferRepo.findById(req.params.bufferId) : undefined;
      let newApiKey: string | undefined = undefined;

      if (!buffer) {
        if (!upsert) {
          res.status(404).json({ error: 'Buffer not found' });
          return;
        }
        if (!isGlobalAdmin) {
          res.status(403).json({ error: 'Global API key required to create buffer via upsert' });
          return;
        }
        
        if (!bufferRepo) {
          res.status(500).json({ error: 'Buffer repository not initialized' });
          return;
        }

        buffer = await bufferRepo.create({
          id: req.params.bufferId,
          name: upsert.name || 'Auto-created Buffer',
          window_time: upsert.window_time || 60,
          webhook_url: upsert.webhook_url,
          max_concurrent_windows: upsert.max_concurrent_windows ?? null,
          require_consumption: upsert.require_consumption ?? false,
          consumption_timeout: upsert.consumption_timeout ?? null,
          webhook_timeout: upsert.webhook_timeout ?? 30000,
          max_resets: upsert.max_resets ?? null,
        });
        newApiKey = buffer.api_key;
      } else {
        if (buffer.api_key !== apiKey && !isGlobalAdmin) {
          res.status(401).json({ error: 'Invalid API key for this buffer' });
          return;
        }

        if (upsert && bufferRepo) {
          // Verify if there are differences to update
          const updates: any = {};
          if (upsert.name !== undefined && upsert.name !== buffer.name) updates.name = upsert.name;
          if (upsert.window_time !== undefined && upsert.window_time !== buffer.window_time) updates.window_time = upsert.window_time;
          if (upsert.webhook_url !== undefined && upsert.webhook_url !== buffer.webhook_url) updates.webhook_url = upsert.webhook_url;
          if (upsert.max_concurrent_windows !== undefined && upsert.max_concurrent_windows !== buffer.max_concurrent_windows) updates.max_concurrent_windows = upsert.max_concurrent_windows;
          if (upsert.require_consumption !== undefined && upsert.require_consumption !== buffer.require_consumption) updates.require_consumption = upsert.require_consumption;
          if (upsert.consumption_timeout !== undefined && upsert.consumption_timeout !== buffer.consumption_timeout) updates.consumption_timeout = upsert.consumption_timeout;
          if (upsert.webhook_timeout !== undefined && upsert.webhook_timeout !== buffer.webhook_timeout) updates.webhook_timeout = upsert.webhook_timeout;
          if (upsert.max_resets !== undefined && upsert.max_resets !== buffer.max_resets) updates.max_resets = upsert.max_resets;

          if (Object.keys(updates).length > 0) {
            buffer = await bufferRepo.update(buffer.id, updates);
            if (!buffer) {
               res.status(500).json({ error: 'Failed to update buffer' });
               return;
            }
            if (windowManager) {
               await windowManager.processQueue(buffer);
            }
          }
        }
      }

      const result = await ingestionService.ingest(buffer, {
        identifier,
        content,
        type,
      });

      if (newApiKey) {
        res.json({ ...result, buffer_api_key: newApiKey });
      } else {
        res.json(result);
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'BUFFER_NOT_FOUND') {
        res.status(404).json({ error: 'Buffer not found' });
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

        const { env } = await import('../config/env.js');
        const isGlobalAdmin = apiKey === env.accessToken;

        const { identifier, upsert } = req.body;
        if (!identifier) {
          res.status(400).json({ error: 'Missing required field: identifier' });
          return;
        }

        let buffer = await bufferRepo.findById(req.params.bufferId);
        let newApiKey: string | undefined = undefined;

        if (!buffer) {
          if (!upsert) {
            res.status(404).json({ error: 'Buffer not found' });
            return;
          }
          if (!isGlobalAdmin) {
            res.status(403).json({ error: 'Global API key required to create buffer via upsert' });
            return;
          }
          
          buffer = await bufferRepo.create({
            id: req.params.bufferId,
            name: upsert.name || 'Auto-created Buffer',
            window_time: upsert.window_time || 60,
            webhook_url: upsert.webhook_url,
            max_concurrent_windows: upsert.max_concurrent_windows ?? null,
            require_consumption: upsert.require_consumption ?? false,
            consumption_timeout: upsert.consumption_timeout ?? null,
            webhook_timeout: upsert.webhook_timeout ?? 30000,
            max_resets: upsert.max_resets ?? null,
          });
          newApiKey = buffer.api_key;
        } else {
          if (buffer.api_key !== apiKey && !isGlobalAdmin) {
            res.status(401).json({ error: 'Invalid API key for this buffer' });
            return;
          }

          if (upsert) {
            const updates: any = {};
            if (upsert.name !== undefined && upsert.name !== buffer.name) updates.name = upsert.name;
            if (upsert.window_time !== undefined && upsert.window_time !== buffer.window_time) updates.window_time = upsert.window_time;
            if (upsert.webhook_url !== undefined && upsert.webhook_url !== buffer.webhook_url) updates.webhook_url = upsert.webhook_url;
            if (upsert.max_concurrent_windows !== undefined && upsert.max_concurrent_windows !== buffer.max_concurrent_windows) updates.max_concurrent_windows = upsert.max_concurrent_windows;
            if (upsert.require_consumption !== undefined && upsert.require_consumption !== buffer.require_consumption) updates.require_consumption = upsert.require_consumption;
            if (upsert.consumption_timeout !== undefined && upsert.consumption_timeout !== buffer.consumption_timeout) updates.consumption_timeout = upsert.consumption_timeout;
            if (upsert.webhook_timeout !== undefined && upsert.webhook_timeout !== buffer.webhook_timeout) updates.webhook_timeout = upsert.webhook_timeout;
            if (upsert.max_resets !== undefined && upsert.max_resets !== buffer.max_resets) updates.max_resets = upsert.max_resets;

            if (Object.keys(updates).length > 0) {
              buffer = await bufferRepo.update(buffer.id, updates);
              if (!buffer) {
                 res.status(500).json({ error: 'Failed to update buffer' });
                 return;
              }
              if (windowManager) {
                 await windowManager.processQueue(buffer);
              }
            }
          }
        }

        const { RedisService } = await import('../services/redis.service.js');
        const redisService = new RedisService();
        const openWindowId = await redisService.getOpenWindowId(buffer.id, identifier);
        
        if (openWindowId) {
          await windowManager.resetWindow(buffer, openWindowId, identifier);
          const updatedWindow = await windowRepo.findById(openWindowId);
          
          const responsePayload: any = {
            success: true,
            reset: true,
            message: 'Window timer reset successfully',
            expires_at: updatedWindow?.expires_at
          };
          if (newApiKey) responsePayload.buffer_api_key = newApiKey;
          
          res.json(responsePayload);
        } else {
          const responsePayload: any = {
            success: true,
            reset: false,
            message: 'No open window found for this identifier',
            expires_at: null
          };
          if (newApiKey) responsePayload.buffer_api_key = newApiKey;
          
          res.json(responsePayload);
        }
      } catch (err) {
        throw err;
      }
    });
  }

  return router;
}
