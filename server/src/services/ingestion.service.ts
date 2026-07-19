import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { MessageRepository } from '../repositories/message.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { WindowManagerService } from './window-manager.service.js';
import { BufferRecord, IngestRequest } from '../models/types.js';

export interface IngestResult {
  accepted: true;
  window_id: string;
  queued: boolean;
  queue_position?: number;
  blocked?: boolean;
}

export class IngestionService {
  constructor(
    private bufferRepo: BufferRepository,
    private windowRepo: WindowRepository,
    private messageRepo: MessageRepository,
    private waitingRepo: WaitingRepository,
    private windowManager: WindowManagerService
  ) {}

  async ingest(bufferId: string, apiKey: string, request: IngestRequest): Promise<IngestResult> {
    const buffer = await this.bufferRepo.findById(bufferId);
    if (!buffer || buffer.api_key !== apiKey) {
      throw new Error('BUFFER_NOT_FOUND');
    }

    const blocked = buffer.require_consumption
      ? !!(await this.windowRepo.findBlockedByIdentifier(bufferId, request.identifier))
      : false;

    const openWindow = await this.windowRepo.findOpenByIdentifier(bufferId, request.identifier);

    if (openWindow) {
      if (buffer.max_resets === null || openWindow.reset_count < buffer.max_resets) {
        await this.windowManager.resetWindow(buffer, openWindow.id, request.identifier);
        await this.windowRepo.incrementResetCount(openWindow.id);
      }
      await this.messageRepo.create(
        openWindow.id,
        bufferId,
        request.identifier,
        request.content,
        request.type
      );
      return { accepted: true, window_id: openWindow.id, queued: false, blocked };
    }

    const openCount = await this.bufferRepo.countOpenWindows(bufferId);
    const limit = buffer.max_concurrent_windows;

    if (limit === null || openCount < limit) {
      if (blocked) {
        await this.waitingRepo.enqueue(bufferId, request.identifier, request.content, request.type);
        const queuePosition = await this.waitingRepo.countByBuffer(bufferId);
        return { accepted: true, window_id: '', queued: true, queue_position: queuePosition, blocked };
      }

      const window = await this.windowRepo.create(bufferId, request.identifier, buffer.window_time);
      await this.windowManager.startWindow(buffer, window.id, request.identifier);
      
      await this.messageRepo.create(
        window.id,
        bufferId,
        request.identifier,
        request.content,
        request.type
      );

      return { accepted: true, window_id: window.id, queued: false, blocked };
    }

    await this.waitingRepo.enqueue(bufferId, request.identifier, request.content, request.type);
    const queuePosition = await this.waitingRepo.countByBuffer(bufferId);
    return { accepted: true, window_id: '', queued: true, queue_position: queuePosition, blocked };
  }
}
