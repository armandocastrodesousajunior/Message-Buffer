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
  private consumptionTimers = new Map<string, ReturnType<typeof setTimeout>>();

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

    const result = await this.webhookService.dispatch(buffer, windowId, identifier, payload);

    if (buffer.require_consumption && result.status === 200) {
      await this.windowRepo.updateStatus(windowId, 'consumed');
    } else {
      await this.windowRepo.updateStatus(windowId, 'closed');

      if (buffer.require_consumption && buffer.consumption_timeout != null) {
        this.startConsumptionTimer(buffer, windowId, identifier);
      }
    }

    await this.processQueue(buffer);
  }

  async confirmConsumption(bufferId: string, identifier: string, windowId: string): Promise<void> {
    const cKey = this.consTimerKey(bufferId, identifier);
    const existing = this.consumptionTimers.get(cKey);
    if (existing) {
      clearTimeout(existing);
      this.consumptionTimers.delete(cKey);
    }

    await this.windowRepo.updateStatus(windowId, 'consumed');

    const buffer = await this.bufferRepo.findById(bufferId);
    if (buffer) {
      await this.processQueue(buffer);
    }
  }

  private startConsumptionTimer(buffer: BufferRecord, windowId: string, identifier: string): void {
    const cKey = this.consTimerKey(buffer.id, identifier);
    const existing = this.consumptionTimers.get(cKey);
    if (existing) {
      clearTimeout(existing);
      this.consumptionTimers.delete(cKey);
    }

    const timer = setTimeout(async () => {
      this.consumptionTimers.delete(cKey);
      await this.windowRepo.updateStatus(windowId, 'expired');
      await this.processQueue(buffer);
    }, buffer.consumption_timeout!);
    timer.unref();

    this.consumptionTimers.set(cKey, timer);
  }

  private async isIdentifierBlocked(bufferId: string, identifier: string): Promise<boolean> {
    const blocked = await this.windowRepo.findBlockedByIdentifier(bufferId, identifier);
    return !!blocked;
  }

  private async processQueue(buffer: BufferRecord): Promise<void> {
    const limit = buffer.max_concurrent_windows;

    while (true) {
      const timerCount = this.countTimersForBuffer(buffer.id);
      if (limit !== null && timerCount >= limit) break;

      let next = await this.waitingRepo.findNextByBuffer(buffer.id);
      if (!next) break;

      if (buffer.require_consumption) {
        const blocked = await this.isIdentifierBlocked(buffer.id, next.identifier);
        if (blocked) {
          next = await this.waitingRepo.findNextUnlocked(buffer.id);
          if (!next) break;
        }
      }

      const batch = await this.waitingRepo.dequeueByIdentifier(buffer.id, next.identifier);
      if (batch.length === 0) break;

      const existingWindow = await this.windowRepo.findOpenByIdentifier(
        buffer.id, next.identifier
      );

      if (existingWindow) {
        for (const msg of batch) {
          await this.messageRepo.create(
            existingWindow.id, buffer.id, msg.identifier, msg.content, msg.type
          );
        }
        await this.resetWindow(buffer, existingWindow.id, next.identifier);
      } else {
        const window = await this.windowRepo.create(
          buffer.id, next.identifier, buffer.window_time
        );
        for (const msg of batch) {
          await this.messageRepo.create(
            window.id, buffer.id, msg.identifier, msg.content, msg.type
          );
        }
        await this.startWindow(buffer, window.id, next.identifier);
      }
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

  private consTimerKey(bufferId: string, identifier: string): string {
    return `cons:${bufferId}:${identifier}`;
  }

  clearAllTimers(): void {
    for (const [, active] of this.activeTimers) {
      clearTimeout(active.timer);
    }
    this.activeTimers.clear();
    for (const [, timer] of this.consumptionTimers) {
      clearTimeout(timer);
    }
    this.consumptionTimers.clear();
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
