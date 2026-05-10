import { BufferRepository } from '../repositories/buffer.repo.js';
import { WindowRepository } from '../repositories/window.repo.js';
import { WaitingRepository } from '../repositories/waiting.repo.js';
import { LogRepository } from '../repositories/log.repo.js';
import { CreateBufferInput, UpdateBufferInput, BufferRecord } from '../models/types.js';

export class BufferService {
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

  async create(input: CreateBufferInput): Promise<BufferRecord> {
    return this.bufferRepo.create(input);
  }

  async update(id: string, input: UpdateBufferInput): Promise<BufferRecord | null> {
    return (await this.bufferRepo.update(id, input)) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    return this.bufferRepo.delete(id);
  }
}
