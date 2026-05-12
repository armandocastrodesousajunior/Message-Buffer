import { getDatabase } from '../database/connection.js';
import { WindowRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class WindowRepository {
  async findOpenByIdentifier(bufferId: string, identifier: string): Promise<WindowRecord | undefined> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId, identifier, status: 'open' })
      .first();
  }

  async findAllOpenByBuffer(bufferId: string): Promise<WindowRecord[]> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId })
      .whereIn('status', ['open', 'processing']);
  }

  async findAllOpenExpired(): Promise<WindowRecord[]> {
    return getDatabase()('windows')
      .where({ status: 'open' })
      .where('expires_at', '<=', new Date().toISOString());
  }

  async create(bufferId: string, identifier: string, windowTimeSeconds: number): Promise<WindowRecord> {
    const now = new Date();
    const record: WindowRecord = {
      id: uuid(),
      buffer_id: bufferId,
      identifier,
      status: 'open',
      expires_at: new Date(now.getTime() + windowTimeSeconds * 1000).toISOString(),
      created_at: now.toISOString(),
    };
    await getDatabase()('windows').insert(record);
    return record;
  }

  async updateStatus(id: string, status: 'open' | 'processing' | 'closed'): Promise<void> {
    await getDatabase()('windows').where({ id }).update({ status });
  }

  async updateExpiresAt(id: string, expiresAt: string): Promise<void> {
    await getDatabase()('windows').where({ id }).update({ expires_at: expiresAt });
  }

  async countOpenByIdentifier(bufferId: string, identifier: string): Promise<number> {
    const result = await getDatabase()('windows')
      .where({ buffer_id: bufferId, identifier })
      .whereIn('status', ['open', 'processing'])
      .count('* as count')
      .first();
    return Number(result?.count || 0);
  }
}
