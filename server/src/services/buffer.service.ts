import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { LogRepository } from '../repositories/log.repo.js';
import { CreateBufferInput, UpdateBufferInput, BufferRecord } from '../models/types.js';
import { RedisService } from './redis.service.js';

export class BufferService {
  private redisService = new RedisService();

  constructor(
    private bufferRepo: BufferRepository,
    private windowRepo: WindowRepository,
    private waitingRepo: WaitingRepository,
    private logRepo: LogRepository
  ) {}

  async list(): Promise<BufferRecord[]> {
    return this.bufferRepo.findAll();
  }

  async getById(id: string): Promise<BufferRecord | null> {
    return (await this.bufferRepo.findById(id)) ?? null;
  }

  async getOpenWindowCount(id: string): Promise<number> {
    return this.redisService.getOpenWindowCount(id);
  }

  async create(input: CreateBufferInput): Promise<BufferRecord> {
    return this.bufferRepo.create(input);
  }

  async update(id: string, input: UpdateBufferInput): Promise<BufferRecord | null> {
    return (await this.bufferRepo.update(id, input)) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    await this.clearBufferData(id);
    return this.bufferRepo.delete(id);
  }

  async clearBufferData(id: string): Promise<boolean> {
    const db = (await import('../database/connection.js')).getDatabase();
    
    // Limpa estado no Redis
    await this.redisService.clearAllBufferData(id);
    await this.waitingRepo.clearBuffer(id);

    // Limpa estado no Postgres
    await db('logs').where({ buffer_id: id }).delete();
    await db('windows').where({ buffer_id: id }).delete();
    return true;
  }

  async clearOpenWindows(id: string): Promise<boolean> {
    // 1. Limpa timers e open_windows hash do Redis
    await this.redisService.clearOpenWindows(id);
    
    // 2. Opcional: apagar as mensagens do Redis (mas se elas expirarem e não acharem timer não farão mal)
    // No Postgres, setamos status para deletado (se quisermos manter logs, se não deletamos). 
    // O painel mostra janelas baseado no Postgres, então apagamos:
    await this.windowRepo.deleteByBufferAndStatus(id, ['open', 'processing']);
    return true;
  }

  async clearWaitingMessages(id: string): Promise<boolean> {
    await this.waitingRepo.clearBuffer(id);
    return true;
  }

  async clearWindowsAwaitingConsumption(id: string): Promise<boolean> {
    // Limpa os timers e status de bloqueio no Redis
    await this.redisService.clearWindowsAwaitingConsumption(id);
    
    // Deleta as janelas no Postgres (que estão com status closed)
    await this.windowRepo.deleteByBufferAndStatus(id, ['closed']);
    return true;
  }
}
