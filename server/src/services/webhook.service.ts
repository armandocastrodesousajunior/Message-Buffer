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
    windowClosedAt?: string | null,  // quando a janela FECHOU (antes do webhook)
    resetCount?: number | null
  ): Promise<{ status: number; body: string }> {
    const callKey = `${buffer.id}:${windowId}`;
    if (this.pendingCalls.has(callKey)) {
      return this.pendingCalls.get(callKey)!;
    }

    const promise = this.executeDispatch(buffer, windowId, identifier, payload, windowStartedAt, windowClosedAt, resetCount);
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
    windowClosedAt?: string | null,
    resetCount?: number | null
  ): Promise<{ status: number; body: string }> {
    let status: number | null = null;
    let body: string | null = null;

    // Calcula duração da janela (do início até fechar)
    let windowDurationMs: number | null = null;
    if (windowStartedAt && windowClosedAt) {
      windowDurationMs = new Date(windowClosedAt).getTime() - new Date(windowStartedAt).getTime();
    }

    console.log(`[webhook] [${identifier}] window=${windowId} → dispatching (janela=${windowDurationMs != null ? windowDurationMs + 'ms' : '?'}, resets=${resetCount ?? 0})`);

    const webhookStart = Date.now();
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

    const webhookDurationMs = Date.now() - webhookStart;
    const totalDurationMs = (windowDurationMs ?? 0) + webhookDurationMs;

    console.log(`[webhook] [${identifier}] window=${windowId} → status=${status} janela=${windowDurationMs ?? '?'}ms webhook=${webhookDurationMs}ms total=${totalDurationMs}ms resets=${resetCount ?? 0}`);

    await this.logRepo.create(
      buffer.id,
      windowId,
      identifier,
      payload,
      status,
      body,
      windowStartedAt ?? null,
      windowClosedAt ?? null,       // ← agora é realmente quando a janela fechou
      webhookDurationMs,            // ← duração só do webhook
      resetCount ?? null,
      windowDurationMs,             // ← duração da janela (novo campo)
    );
    return { status, body: body ?? '' };
  }
}

