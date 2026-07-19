import { Router, Request, Response } from 'express';
import { BufferService } from '../services/buffer.service.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { WindowManagerService } from '../services/window-manager.service.js';
import { LogRepository } from '../repositories/log.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { RedisService } from '../services/redis.service.js';
import { MessageRepository } from '../repositories/message.repo.js';

export function createWebRoutes(
  bufferService: BufferService,
  logRepo: LogRepository,
  windowRepo?: WindowRepository,
  windowManager?: WindowManagerService,
  waitingRepo?: WaitingRepository
): Router {
  const router = Router();
  const redisService = new RedisService();
  const messageRepo = new MessageRepository();

  router.get('/buffers', async (_req: Request, res: Response) => {
    const buffers = await bufferService.list();
    res.json(buffers);
  });

  router.post('/buffers', async (req: Request, res: Response) => {
    const { name, window_time, webhook_url, max_concurrent_windows, require_consumption, consumption_timeout, webhook_timeout, max_resets } = req.body;

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
        max_concurrent_windows == null || max_concurrent_windows === ''
          ? null
          : parseInt(max_concurrent_windows, 10),
      require_consumption: require_consumption === true,
      consumption_timeout:
        consumption_timeout == null || consumption_timeout === ''
          ? null
          : parseInt(consumption_timeout, 10),
      webhook_timeout:
        webhook_timeout == null || webhook_timeout === ''
          ? 30000
          : parseInt(webhook_timeout, 10),
      max_resets:
        max_resets == null || max_resets === ''
          ? null
          : parseInt(max_resets, 10),
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
    const { name, window_time, webhook_url, max_concurrent_windows, require_consumption, consumption_timeout, webhook_timeout, max_resets } = req.body;

    const buffer = await bufferService.update(req.params.id, {
      name,
      window_time: window_time ? parseInt(window_time, 10) : undefined,
      webhook_url,
      max_concurrent_windows:
        max_concurrent_windows == null || max_concurrent_windows === ''
          ? null
          : parseInt(max_concurrent_windows, 10),
      require_consumption:
        require_consumption == null ? undefined : require_consumption === true,
      consumption_timeout:
        consumption_timeout == null || consumption_timeout === ''
          ? null
          : parseInt(consumption_timeout, 10),
      webhook_timeout:
        webhook_timeout == null || webhook_timeout === ''
          ? undefined
          : parseInt(webhook_timeout, 10),
      max_resets:
        max_resets == null || max_resets === ''
          ? null
          : parseInt(max_resets, 10),
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const result = await logRepo.findByBufferIdPaginated(req.params.id, page, limit);
    res.json(result);
  });

  if (windowRepo) {
    router.get('/buffers/:id/windows', async (req: Request, res: Response) => {
      const status = req.query.status as string | undefined;
      const windows = await windowRepo.findByBuffer(
        req.params.id,
        status as any
      );
      res.json(windows);
    });
  }

  if (windowRepo && windowManager && redisService && messageRepo) {
    router.post('/buffers/:id/windows/:windowId/confirm', async (req: Request, res: Response) => {
      try {
        const buffer = await bufferService.getById(req.params.id);
        if (!buffer) {
          return res.status(404).json({ error: 'Buffer not found' });
        }
        
        // Pega a janela ANTES de dar o update
        const win = await windowRepo.findById(req.params.windowId);
        if (!win) {
          return res.status(404).json({ error: 'Window not found' });
        }
        
        // Se já foi consumida por duplo-clique ou pelo sweeper, ignora
        if (win.status === 'consumed') {
          return res.json({ success: true, ignored: true });
        }

        // Tenta remover do bloqueio no redis como forma de lock (se retornar 0, outro confirm já processou)
        const removed = await redisService.claimConsumptionLock(buffer.id, win.id);
        if (!removed) {
           return res.json({ success: true, ignored: true });
        }
        
        await windowRepo.updateStatus(req.params.windowId, 'consumed');
        await redisService.consumeWindow(buffer.id, win.identifier, win.id);
        await messageRepo.clearWindow(win.id);
        
        // Tenta puxar a fila
        await windowManager.processQueue(buffer);
        
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  if (windowRepo && waitingRepo) {
    router.get('/buffers/:id/stats', async (req: Request, res: Response) => {
      const openWindows = await bufferService.getOpenWindowCount(req.params.id);
      const waitingMessages = await waitingRepo.countByBuffer(req.params.id);
      res.json({ openWindows, waitingMessages });
    });
    
    router.post('/buffers/:id/reset', async (req: Request, res: Response) => {
      if (windowManager) {
        windowManager.clearTimersForBuffer(req.params.id);
      }
      await bufferService.clearBufferData(req.params.id);
      res.json({ success: true });
    });

    router.post('/buffers/:id/clear/open-windows', async (req: Request, res: Response) => {
      if (windowManager) {
        windowManager.clearTimersForBuffer(req.params.id);
      }
      await bufferService.clearOpenWindows(req.params.id);
      
      const buffer = await bufferService.getById(req.params.id);
      if (buffer && windowManager) {
        await windowManager.processQueue(buffer);
      }
      
      res.json({ success: true });
    });

    router.post('/buffers/:id/clear/waiting-messages', async (req: Request, res: Response) => {
      await bufferService.clearWaitingMessages(req.params.id);
      res.json({ success: true });
    });

    router.post('/buffers/:id/clear/awaiting-consumption', async (req: Request, res: Response) => {
      if (windowManager) {
        windowManager.clearTimersForBuffer(req.params.id);
      }
      await bufferService.clearWindowsAwaitingConsumption(req.params.id);
      
      const buffer = await bufferService.getById(req.params.id);
      if (buffer && windowManager) {
        await windowManager.processQueue(buffer);
      }

      res.json({ success: true });
    });
  }

  return router;
}
