import { Router, Request, Response } from 'express';
import { BufferService } from '../services/buffer.service.js';
import { LogRepository } from '../repositories/log.repo.js';

export function createWebRoutes(
  bufferService: BufferService,
  logRepo: LogRepository
): Router {
  const router = Router();

  router.get('/buffers', async (_req: Request, res: Response) => {
    const buffers = await bufferService.list();
    res.json(buffers);
  });

  router.post('/buffers', async (req: Request, res: Response) => {
    const { name, window_time, webhook_url, max_concurrent_windows } = req.body;

    if (!name || !window_time || !webhook_url) {
      res.status(400).json({
        error: 'Missing required fields: name, window_time, webhook_url',
      });
      return;
    }

    const buffer = await bufferService.create({
      name,
      window_time: parseInt(window_time, 10),
      webhook_url,
      max_concurrent_windows:
        max_concurrent_windows === undefined || max_concurrent_windows === ''
          ? null
          : parseInt(max_concurrent_windows, 10),
    });

    res.status(201).json(buffer);
  });

  router.get('/buffers/:id', async (req: Request, res: Response) => {
    const buffer = await bufferService.getById(req.params.id);
    if (!buffer) {
      res.status(404).json({ error: 'Buffer not found' });
      return;
    }
    res.json(buffer);
  });

  router.put('/buffers/:id', async (req: Request, res: Response) => {
    const { name, window_time, webhook_url, max_concurrent_windows } = req.body;

    const buffer = await bufferService.update(req.params.id, {
      name,
      window_time: window_time ? parseInt(window_time, 10) : undefined,
      webhook_url,
      max_concurrent_windows:
        max_concurrent_windows === undefined || max_concurrent_windows === ''
          ? null
          : max_concurrent_windows
            ? parseInt(max_concurrent_windows, 10)
            : undefined,
    });

    if (!buffer) {
      res.status(404).json({ error: 'Buffer not found' });
      return;
    }
    res.json(buffer);
  });

  router.delete('/buffers/:id', async (req: Request, res: Response) => {
    const deleted = await bufferService.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Buffer not found' });
      return;
    }
    res.status(204).send();
  });

  router.get('/buffers/:id/logs', async (req: Request, res: Response) => {
    const logs = await logRepo.findByBufferId(req.params.id);
    res.json(logs);
  });

  return router;
}
