import { getDatabase } from '../database/connection.js';
import { WindowRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';

type WindowStatus = WindowRecord['status'];

export class WindowRepository {
  async findById(id: string): Promise<WindowRecord | undefined> {
    return getDatabase()('windows').where({ id }).first();
  }

  async findOpenByIdentifier(bufferId: string, identifier: string): Promise<WindowRecord | undefined> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId, identifier, status: 'open' })
      .first();
  }

  async findBlockedByIdentifier(bufferId: string, identifier: string): Promise<WindowRecord | undefined> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId, identifier })
      .whereIn('status', ['closed', 'processing'])
      .orderBy('created_at', 'desc')
      .first();
  }

  async findAllOpenByBuffer(bufferId: string): Promise<WindowRecord[]> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId })
      .whereIn('status', ['open', 'processing']);
  }

  async countAllOpenByBuffer(bufferId: string): Promise<number> {
    const result = await getDatabase()('windows')
      .where({ buffer_id: bufferId })
      .whereIn('status', ['open', 'processing'])
      .count('* as count')
      .first();
    return Number(result?.count || 0);
  }

  async findAllExpired(status: WindowStatus): Promise<WindowRecord[]> {
    return getDatabase()('windows')
      .where({ status })
      .where('expires_at', '<=', new Date().toISOString());
  }

  async findPendingByBuffer(bufferId: string): Promise<WindowRecord[]> {
    return getDatabase()('windows')
      .where({ buffer_id: bufferId, status: 'closed' })
      .orderBy('created_at', 'asc');
  }

  async findByBufferWithLogs(bufferId: string, status?: WindowStatus): Promise<any[]> {
    const query = getDatabase()('windows as w')
      .leftJoin('logs as l', 'w.id', 'l.window_id')
      .where({ 'w.buffer_id': bufferId })
      .select(
        'w.*',
        'l.webhook_response_status',
        'l.created_at as webhook_sent_at'
      )
      .orderBy('w.created_at', 'desc');
    if (status) query.andWhere('w.status', status);
    return query;
  }

  async findByBuffer(bufferId: string, status?: WindowStatus): Promise<WindowRecord[]> {
    const query = getDatabase()('windows').where({ buffer_id: bufferId });
    if (status) query.andWhere({ status });
    return query.orderBy('created_at', 'desc');
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

  async updateStatus(id: string, status: WindowStatus): Promise<void> {
    await getDatabase()('windows').where({ id }).update({ status });
  }

  async claimWindowForProcessing(id: string): Promise<boolean> {
    const updated = await getDatabase()('windows')
      .where({ id, status: 'open' })
      .update({ status: 'processing' });
    return updated > 0;
  }

  async claimWindowForExpiration(id: string): Promise<boolean> {
    const updated = await getDatabase()('windows')
      .where({ id, status: 'closed' })
      .update({ status: 'expired' });
    return updated > 0;
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
