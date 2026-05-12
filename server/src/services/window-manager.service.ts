import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { MessageRepository } from '../repositories/message.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { WebhookService } from './webhook.service.js';
import { BufferRecord, WebhookPayload } from '../models/types.js';

interface ActiveWindow {
  timer: ReturnType<typeof setTimeout>;
  windowId: string;
}

export class WindowManagerService {
  private activeTimers = new Map<string, ActiveWindow>();

  constructor(
    private bufferRepo: BufferRepository,
    private windowRepo: WindowRepository,
    private messageRepo: MessageRepository,
    private waitingRepo: WaitingRepository,
    private webhookService: WebhookService
  ) {}

  async resetWindow(
    buffer: BufferRecord,
    windowId: string,
    identifier: string
  ): Promise<void> {
    const timerKey = this.timerKey(buffer.id, identifier);

    const existing = this.activeTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing.timer);
      this.activeTimers.delete(timerKey);
    }

    const expiresAt = new Date(Date.now() + buffer.window_time * 1000).toISOString();
    await this.windowRepo.updateExpiresAt(windowId, expiresAt);

    const timer = setTimeout(
      () => this.expireWindow(buffer, windowId, identifier),
      buffer.window_time * 1000
    );
    timer.unref();

    this.activeTimers.set(timerKey, { timer, windowId });
  }

  async startWindow(
    buffer: BufferRecord,
    windowId: string,
    identifier: string
  ): Promise<void> {
    const timerKey = this.timerKey(buffer.id, identifier);

    const existing = this.activeTimers.get(timerKey);
    if (existing) return;

    const remainingMs = buffer.window_time * 1000;
    if (remainingMs <= 0) {
      await this.expireWindow(buffer, windowId, identifier);
      return;
    }

    const timer = setTimeout(
      () => this.expireWindow(buffer, windowId, identifier),
      remainingMs
    );
    timer.unref();

    this.activeTimers.set(timerKey, { timer, windowId });
  }

  async recoverWindows(): Promise<void> {
    const expired = await this.windowRepo.findAllOpenExpired();
    for (const window of expired) {
      const buffer = await this.bufferRepo.findById(window.buffer_id);
      if (buffer) {
        await this.expireWindow(buffer, window.id, window.identifier);
      }
    }

    const allBuffers = await this.bufferRepo.findAll();
    for (const buffer of allBuffers) {
      const openWindows = await this.windowRepo.findAllOpenByBuffer(buffer.id);
      for (const window of openWindows) {
        if (window.status === 'open') {
          await this.startWindow(buffer, window.id, window.identifier);
        }
      }
    }
  }

  async expireWindow(
    buffer: BufferRecord,
    windowId: string,
    identifier: string
  ): Promise<void> {
    const timerKey = this.timerKey(buffer.id, identifier);

    const existing = this.activeTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing.timer);
      this.activeTimers.delete(timerKey);
    }

    await this.windowRepo.updateStatus(windowId, 'processing');

    const messages = await this.messageRepo.findByWindowId(windowId);

    const payload: WebhookPayload = {
      identifier,
      buffer_id: buffer.id,
      messages: messages.map((m) => ({
        type: m.type,
        content: parseContent(m.content, m.type),
        received_at: m.received_at,
      })),
    };

    await this.webhookService.dispatch(buffer, windowId, identifier, payload);
    await this.windowRepo.updateStatus(windowId, 'closed');

    await this.processQueue(buffer);
  }

  private async processQueue(buffer: BufferRecord): Promise<void> {
    const limit = buffer.max_concurrent_windows;

    while (true) {
      const openCount = await this.bufferRepo.countOpenWindows(buffer.id);
      const timerCount = this.countTimersForBuffer(buffer.id);

      if (limit !== null && openCount + timerCount >= limit) break;

      const next = await this.waitingRepo.dequeue(buffer.id);
      if (!next) break;

      const window = await this.windowRepo.create(
        buffer.id,
        next.identifier,
        buffer.window_time
      );
      await this.messageRepo.create(
        window.id,
        buffer.id,
        next.identifier,
        next.content,
        next.type
      );
      await this.startWindow(buffer, window.id, next.identifier);
    }
  }

  private countTimersForBuffer(bufferId: string): number {
    let count = 0;
    const prefix = `${bufferId}:`;
    for (const key of this.activeTimers.keys()) {
      if (key.startsWith(prefix)) count++;
    }
    return count;
  }

  private timerKey(bufferId: string, identifier: string): string {
    return `${bufferId}:${identifier}`;
  }

  clearAllTimers(): void {
    for (const [, active] of this.activeTimers) {
      clearTimeout(active.timer);
    }
    this.activeTimers.clear();
  }
}

function parseContent(content: string, type: string): unknown {
  if (type === 'json') {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  if (type === 'number') return Number(content);
  if (type === 'boolean') return content === 'true';
  return content;
}
