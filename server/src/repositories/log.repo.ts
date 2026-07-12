import { getDatabase } from '../database/connection.js';
import { LogRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class LogRepository {
  async create(
    bufferId: string,
    windowId: string | null,
    identifier: string,
    webhookPayload: unknown,
    responseStatus: number | null,
    responseBody: string | null
  ): Promise<LogRecord> {
    const record: LogRecord = {
      id: uuid(),
      buffer_id: bufferId,
      window_id: windowId,
      identifier,
      webhook_payload: JSON.stringify(webhookPayload),
      webhook_response_status: responseStatus,
      webhook_response_body: responseBody,
      created_at: new Date().toISOString(),
    };
    await getDatabase()('logs').insert(record);
    return record;
  }

  async findByBufferId(bufferId: string): Promise<LogRecord[]> {
    return getDatabase()('logs')
      .where({ buffer_id: bufferId })
      .orderBy('created_at', 'desc');
  }

  async findByBufferIdPaginated(bufferId: string, page: number, limit: number) {
    const db = getDatabase();
    
    const countResult = await db('logs')
      .where({ buffer_id: bufferId })
      .count('id as total')
      .first();
      
    const total = Number(countResult?.total || 0);
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;

    const data = await db('logs')
      .where({ buffer_id: bufferId })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    return {
      data,
      total,
      page,
      totalPages,
    };
  }
}
