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
    payload: unknown
  ): Promise<{ status: number; body: string }> {
    const callKey = `${buffer.id}:${windowId}`;
    if (this.pendingCalls.has(callKey)) {
      return this.pendingCalls.get(callKey)!;
    }

    const promise = this.executeDispatch(buffer, windowId, identifier, payload);
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
    payload: unknown
  ): Promise<{ status: number; body: string }> {
    let status: number | null = null;
    let body: string | null = null;

    try {
      const response = await axios.post(buffer.webhook_url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
        validateStatus: () => true,
      });
      status = response.status;
      body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (err) {
      status = 0;
      body = err instanceof Error ? err.message : 'Unknown error';
    }

    await this.logRepo.create(buffer.id, windowId, identifier, payload, status, body);
    return { status, body: body ?? '' };
  }
}
