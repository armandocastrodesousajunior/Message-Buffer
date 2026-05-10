import { getDatabase } from '../database/connection.js';
import { BufferRecord, CreateBufferInput, UpdateBufferInput } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class BufferRepository {
  async findAll(): Promise<BufferRecord[]> {
    return getDatabase()('buffers').orderBy('created_at', 'desc');
  }

  async findById(id: string): Promise<BufferRecord | undefined> {
    return getDatabase()('buffers').where({ id }).first();
  }

  async findByApiKey(apiKey: string): Promise<BufferRecord | undefined> {
    return getDatabase()('buffers').where({ api_key: apiKey }).first();
  }

  async create(input: CreateBufferInput): Promise<BufferRecord> {
    const now = new Date().toISOString();
    const record: BufferRecord = {
      id: uuid(),
      name: input.name,
      window_time: input.window_time,
      webhook_url: input.webhook_url,
      max_concurrent_windows: input.max_concurrent_windows ?? null,
      api_key: uuid(),
      created_at: now,
      updated_at: now,
    };
    await getDatabase()('buffers').insert(record);
    return record;
  }

  async update(id: string, input: UpdateBufferInput): Promise<BufferRecord | undefined> {
    const existing = await this.findById(id);
    if (!existing) return undefined;

    const updates: Partial<BufferRecord> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.window_time !== undefined) updates.window_time = input.window_time;
    if (input.webhook_url !== undefined) updates.webhook_url = input.webhook_url;
    if (input.max_concurrent_windows !== undefined) updates.max_concurrent_windows = input.max_concurrent_windows;

    await getDatabase()('buffers').where({ id }).update(updates);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDatabase()('buffers').where({ id }).delete();
    return deleted > 0;
  }

  async countOpenWindows(bufferId: string): Promise<number> {
    const result = await getDatabase()('windows')
      .where({ buffer_id: bufferId })
      .whereIn('status', ['open', 'processing'])
      .count('* as count')
      .first();
    return Number(result?.count || 0);
  }
}
