import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { MessageRepository } from '../repositories/message.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { WindowManagerService } from './window-manager.service.js';
import { BufferRecord, IngestRequest } from '../models/types.js';
import { RedisService } from './redis.service.js';

export interface IngestResult {
  accepted: true;
  window_id: string;
  queued: boolean;
  queue_position?: number;
  blocked?: boolean;
}

export class IngestionService {
  private redisService: RedisService;

  constructor(
    private bufferRepo: BufferRepository,
    private windowRepo: WindowRepository,
    private messageRepo: MessageRepository,
    private waitingRepo: WaitingRepository,
    private windowManager: WindowManagerService
  ) {
    this.redisService = new RedisService();
  }

  async ingest(buffer: BufferRecord, request: IngestRequest): Promise<IngestResult> {
    const bufferId = buffer.id;

    const blocked = buffer.require_consumption
      ? await this.redisService.isBlocked(bufferId, request.identifier)
      : false;

    // Fast Path via Redis Hash
    const openWindowId = await this.redisService.getOpenWindowId(bufferId, request.identifier);

    if (openWindowId) {
      const canReset = await this.redisService.incrementAndCheckResets(bufferId, openWindowId, buffer.max_resets);
      if (canReset) {
        await this.windowManager.resetWindow(buffer, openWindowId, request.identifier);
      }
      
      await this.messageRepo.create(
        openWindowId,
        bufferId,
        request.identifier,
        request.content,
        request.type
      );
      return { accepted: true, window_id: openWindowId, queued: false, blocked };
    }

    // New Window Path
    const limit = buffer.max_concurrent_windows;
    let allowedToOpen = true;

    if (limit !== null) {
      const newCount = await this.redisService.incrementActiveCount(bufferId);
      if (newCount > limit) {
        await this.redisService.decrementActiveCount(bufferId);
        allowedToOpen = false;
      }
    } else {
      await this.redisService.incrementActiveCount(bufferId); // Se não tem limite, apenas incrementa
    }

    if (allowedToOpen) {
      if (blocked) {
        // Estava bloqueado, reverte o contador pois não pode abrir janela real
        await this.redisService.decrementActiveCount(bufferId);
        
        await this.waitingRepo.enqueue(bufferId, request.identifier, request.content, request.type);
        const queuePosition = await this.waitingRepo.countByBuffer(bufferId);
        return { accepted: true, window_id: '', queued: true, queue_position: queuePosition, blocked };
      }

      try {
        // 1. Persist no Postgres para gerar o histórico e o ID
        const window = await this.windowRepo.create(bufferId, request.identifier, buffer.window_time);
        
        // 2. Trava em memória RAM no Redis
        await this.windowManager.startWindow(buffer, window.id, request.identifier);
        
        // 3. Empilha mensagem na fila efêmera (Redis)
        await this.messageRepo.create(
          window.id,
          bufferId,
          request.identifier,
          request.content,
          request.type
        );

        return { accepted: true, window_id: window.id, queued: false, blocked };
      } catch (err) {
        await this.redisService.decrementActiveCount(bufferId);
        throw err;
      }
    }

    // Queue limit exceeded
    await this.waitingRepo.enqueue(bufferId, request.identifier, request.content, request.type);
    const queuePosition = await this.waitingRepo.countByBuffer(bufferId);
    return { accepted: true, window_id: '', queued: true, queue_position: queuePosition, blocked };
  }
}
