import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { MessageRepository } from '../repositories/message.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { WebhookService } from './webhook.service.js';
import { BufferRecord, WebhookPayload } from '../models/types.js';
import { RedisService } from './redis.service.js';

export class WindowManagerService {
  private sweeperInterval: ReturnType<typeof setInterval>;
  private redisService: RedisService;

  constructor(
    private bufferRepo: BufferRepository,
    private windowRepo: WindowRepository,
    private messageRepo: MessageRepository,
    private waitingRepo: WaitingRepository,
    private webhookService: WebhookService
  ) {
    this.redisService = new RedisService();
    this.sweeperInterval = setInterval(() => this.sweepExpiredWindows(), 1000); // Varre 1x por segundo
  }

  private async sweepExpiredWindows(): Promise<void> {
    try {
      const allBuffers = await this.bufferRepo.findAll();
      const now = Date.now();
      
      await Promise.all(allBuffers.map(async (buffer) => {
        // 1. Janelas Abertas que Expiraram — processa TODAS em paralelo
        const expiredWindows = await this.redisService.getExpiredWindows(buffer.id, now);
        await Promise.all(expiredWindows.map(async (windowId) => {
          const claimed = await this.redisService.claimTimerLock(buffer.id, windowId);
          if (claimed) {
            await this.expireWindow(buffer, windowId);
          }
        }));

        // 2. Janelas Fechadas que excederam o Tempo de Consumo — processa TODAS em paralelo
        const expiredConsumptions = await this.redisService.getExpiredConsumptionWindows(buffer.id, now);
        await Promise.all(expiredConsumptions.map(async (windowId) => {
          const claimed = await this.redisService.claimConsumptionLock(buffer.id, windowId);
          if (claimed) {
            await this.windowRepo.updateStatus(windowId, 'expired');
            const win = await this.windowRepo.findById(windowId);
            if (win) {
              await this.redisService.expireConsumptionTimeout(buffer.id, win.identifier, windowId);
              await this.processQueue(buffer);
            }
          }
        }));
      }));
    } catch (err) {
      console.error('[sweepExpiredWindows] Erro na varredura:', err);
    }
  }

  async resetWindow(buffer: BufferRecord, windowId: string, identifier: string): Promise<void> {
    const newDelay = buffer.window_time * 1000;
    const expiresAt = Date.now() + newDelay;
    await this.redisService.updateWindowTimer(buffer.id, windowId, expiresAt);
    
    // Atualiza expires_at e incrementa reset_count no Postgres para a UI refletir
    try {
      await Promise.all([
        this.windowRepo.updateExpiresAt(windowId, new Date(expiresAt).toISOString()),
        this.windowRepo.incrementResetCount(windowId),
      ]);
    } catch (e) {
       // ignora falha em background para update puramente visual
    }
  }

  async startWindow(buffer: BufferRecord, windowId: string, identifier: string): Promise<void> {
    const expiresAt = Date.now() + buffer.window_time * 1000;
    await this.redisService.openWindow(buffer.id, identifier, windowId, expiresAt);
  }

  async recoverWindows(): Promise<void> {
    const allBuffers = await this.bufferRepo.findAll();
    for (const buffer of allBuffers) {
       // Zera o cronômetro de todas as janelas ativas para que o sweeper as consuma instantaneamente
       await this.redisService.expireAllActiveWindows(buffer.id);
       await this.processQueue(buffer);
    }
  }

  async expireWindow(buffer: BufferRecord, windowId: string): Promise<void> {
    const win = await this.windowRepo.findById(windowId);
    if (!win) return; // Janela não encontrada no DB
    const identifier = win.identifier;

    // Marca quando a janela terminou de receber mensagens
    const finishedAt = new Date().toISOString();
    await this.windowRepo.updateFinishedAt(windowId, finishedAt);

    // Atualiza DB e prepara para webhook
    await this.windowRepo.updateStatus(windowId, 'processing');

    const messages = await this.messageRepo.findByWindow(windowId);
    
    const payload: WebhookPayload = {
      identifier,
      buffer_id: buffer.id,
      messages: messages.map((m) => ({
        type: m.type,
        content: parseContent(m.content as string, m.type),
        received_at: m.received_at,
      })),
    };

    const result = await this.webhookService.dispatch(
      buffer,
      windowId,
      identifier,
      payload,
      win.started_at,
      win.reset_count
    );

    if (buffer.require_consumption && result.status === 200) {
      // Configurado sem timeout de consumo e sucesso imediato: Marca como consumido
      await this.windowRepo.updateStatus(windowId, 'consumed');
      await this.redisService.consumeWindow(buffer.id, identifier, windowId);
      await this.messageRepo.clearWindow(windowId);
    } else {
      if (buffer.require_consumption) {
        // Exige consumo e a resposta não foi 200.
        // Se consumption_timeout for nulo, ficará bloqueado indefinidamente até confirmação manual.
        await this.windowRepo.updateStatus(windowId, 'closed');
        await this.redisService.closeWindow(buffer.id, identifier, windowId, buffer.consumption_timeout);
      } else {
        // Não exige consumo: expira direto
        await this.windowRepo.updateStatus(windowId, 'closed');
        await this.redisService.expireWindowWithoutConsumption(buffer.id, identifier, windowId);
        await this.messageRepo.clearWindow(windowId);
      }
    }

    await this.processQueue(buffer);
  }

  async confirmConsumption(bufferId: string, identifier: string, windowId: string): Promise<void> {
    await this.redisService.claimConsumptionLock(bufferId, windowId); // Limpa o timer caso exista
    await this.windowRepo.updateStatus(windowId, 'consumed');
    await this.redisService.consumeWindow(bufferId, identifier, windowId);
    await this.messageRepo.clearWindow(windowId);
    
    const buffer = await this.bufferRepo.findById(bufferId);
    if (buffer) {
      await this.processQueue(buffer);
    }
  }

  async processQueue(buffer: BufferRecord): Promise<void> {
    // Tenta adquirir o lock exclusivo para este buffer
    // Se outro processQueue já está rodando, simplesmente ignora esta chamada
    const acquired = await this.redisService.acquireProcessQueueLock(buffer.id);
    if (!acquired) return;

    try {
      const limit = buffer.max_concurrent_windows;
      
      // Reconcilia o active_count com a realidade antes de começar
      // Isso corrige desincronizações causadas por chamadas concorrentes anteriores
      const realCount = await this.redisService.reconcileActiveCount(buffer.id);

      // Se já atingiu o limite real, nem entra no loop
      if (limit !== null && realCount >= limit) {
        return;
      }

      while (true) {
        if (limit !== null) {
          const newCount = await this.redisService.incrementActiveCount(buffer.id);
          if (newCount > limit) {
            await this.redisService.decrementActiveCount(buffer.id);
            break; // Bateu no limite global
          }
        } else {
          await this.redisService.incrementActiveCount(buffer.id);
        }

        // Procura o próximo identifier na fila que não esteja bloqueado
        const nextIdentifier = await this.waitingRepo.popNextUnlockedIdentifier(buffer.id, this.redisService);
        if (!nextIdentifier) {
          // Reverte o contador já que não tem nada pra consumir
          await this.redisService.decrementActiveCount(buffer.id);
          break; // Sem candidatos elegíveis
        }

        const batch = await this.waitingRepo.dequeueByIdentifier(buffer.id, nextIdentifier);
        if (batch.length === 0) {
          await this.redisService.decrementActiveCount(buffer.id);
          continue;
        }

        // Inicia a nova janela para este identifier
        try {
          const window = await this.windowRepo.create(buffer.id, nextIdentifier, buffer.window_time);
          await this.startWindow(buffer, window.id, nextIdentifier);
          
          for (const msg of batch) {
            await this.messageRepo.create(window.id, buffer.id, msg.identifier, msg.content, msg.type).catch(console.error);
          }
        } catch (err) {
          console.error('[processQueue] Erro ao criar janela', err);
          await this.redisService.decrementActiveCount(buffer.id);
          break;
        }
      }
    } finally {
      // Sempre libera o lock, mesmo se ocorrer um erro
      await this.redisService.releaseProcessQueueLock(buffer.id);
    }
  }

  clearAllTimers(): void {
    clearInterval(this.sweeperInterval);
  }

  clearTimersForBuffer(bufferId: string): void {
    // Delegado ao RedisService
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
