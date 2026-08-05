import axios from 'axios';
import { LogRepository } from '../repositories/log.repo.js';
import { BufferRecord } from '../models/types.js';

export class WebhookService {
  private pendingCalls = new Map<string, Promise<{ status: number; body: string }>>();

  constructor(private logRepo: LogRepository) {}

  async dispatch(
    buffer: BufferRecord,
    windowId: string,
    identifier: string,
    payload: unknown,
    windowStartedAt?: string | null,
    resetCount?: number | null
  ): Promise<{ status: number; body: string }> {
    const callKey = `${buffer.id}:${windowId}`;
    if (this.pendingCalls.has(callKey)) {
      return this.pendingCalls.get(callKey)!;
    }

    const promise = this.executeDispatch(buffer, windowId, identifier, payload, windowStartedAt, resetCount);
    this.pendingCalls.set(callKey, promise);

    try {
      return await promise;
    } finally {
      this.pendingCalls.delete(callKey);
    }
  }

  private async executeDispatch(
    buffer: BufferRecord,
    windowId: string,
    identifier: string,
    payload: unknown,
    windowStartedAt?: string | null,
    resetCount?: number | null
  ): Promise<{ status: number; body: string }> {
    let status: number | null = null;
    let body: string | null = null;
    const dispatchStart = Date.now();
    const finishedAt = new Date().toISOString();

    console.log(`[webhook] [${identifier}] window=${windowId} → dispatching to ${buffer.webhook_url} (started_at=${windowStartedAt}, resets=${resetCount ?? 0})`);

    try {
      const response = await axios.post(buffer.webhook_url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: (buffer.webhook_timeout ?? 30000),
        validateStatus: () => true,
      });
      status = response.status;
      body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (err) {
      status = 0;
      body = err instanceof Error ? err.message : 'Unknown error';
    }

    const durationMs = Date.now() - dispatchStart;
    const windowFinishedAt = new Date().toISOString();

    console.log(`[webhook] [${identifier}] window=${windowId} → status=${status} duration=${durationMs}ms resets=${resetCount ?? 0} started=${windowStartedAt} finished=${windowFinishedAt}`);

    await this.logRepo.create(
      buffer.id,
      windowId,
      identifier,
      payload,
      status,
      body,
      windowStartedAt ?? null,
      windowFinishedAt,
      durationMs,
      resetCount ?? null
    );
    return { status, body: body ?? '' };
  }
}

