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

    const openWindow = await this.windowRepo.findOpenByIdentifier(bufferId, request.identifier);

    if (openWindow) {
      await this.messageRepo.create(
        openWindow.id,
        bufferId,
        request.identifier,
        request.content,
        request.type
      );
      return { accepted: true, window_id: openWindow.id, queued: false };
    }

    const openCount = await this.bufferRepo.countOpenWindows(bufferId);
    const limit = buffer.max_concurrent_windows;

    if (limit === null || openCount < limit) {
      const window = await this.windowRepo.create(bufferId, request.identifier, buffer.window_time);
      await this.messageRepo.create(
        window.id,
        bufferId,
        request.identifier,
        request.content,
        request.type
      );

      await this.windowManager.startWindow(buffer, window.id, request.identifier);
      return { accepted: true, window_id: window.id, queued: false };
    }

    await this.waitingRepo.enqueue(bufferId, request.identifier, request.content, request.type);
    return { accepted: true, window_id: '', queued: true };
  }
}
