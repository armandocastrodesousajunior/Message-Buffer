import { getDatabase } from '../database/connection.js';
import { BufferRecord, CreateBufferInput, UpdateBufferInput } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class BufferRepository {
  private mapBuffer(row: any): BufferRecord {
    return { ...row, require_consumption: !!row.require_consumption };
  }

  async findAll(): Promise<BufferRecord[]> {
    const rows = await getDatabase()('buffers').orderBy('created_at', 'desc');
    return rows.map(r => this.mapBuffer(r));
  }

  async findById(id: string): Promise<BufferRecord | undefined> {
    const row = await getDatabase()('buffers').where({ id }).first();
    return row ? this.mapBuffer(row) : undefined;
  }

  async findByApiKey(apiKey: string): Promise<BufferRecord | undefined> {
    const row = await getDatabase()('buffers').where({ api_key: apiKey }).first();
    return row ? this.mapBuffer(row) : undefined;
  }

  async create(input: CreateBufferInput): Promise<BufferRecord> {
    const now = new Date().toISOString();
    const record: BufferRecord = {
      id: uuid(),
      name: input.name,
      window_time: input.window_time,
      webhook_url: input.webhook_url,
      max_concurrent_windows: (Number.isFinite(input.max_concurrent_windows) ? input.max_concurrent_windows : null) as number | null,
      require_consumption: input.require_consumption ?? false,
      consumption_timeout: (Number.isFinite(input.consumption_timeout) ? input.consumption_timeout : null) as number | null,
      webhook_timeout: input.webhook_timeout ?? 30000,
      max_resets: (Number.isFinite(input.max_resets) ? input.max_resets : null) as number | null,
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
    if (input.require_consumption !== undefined) updates.require_consumption = input.require_consumption;
    if (input.consumption_timeout !== undefined) updates.consumption_timeout = input.consumption_timeout;
    if (input.webhook_timeout !== undefined) updates.webhook_timeout = input.webhook_timeout;
    if (input.max_resets !== undefined) updates.max_resets = input.max_resets;

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
