import { getDatabase } from '../database/connection.js';
import { WaitingMessageRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class WaitingRepository {
  async enqueue(
    bufferId: string,
    identifier: string,
    content: unknown,
    type: string
  ): Promise<WaitingMessageRecord> {
    const record: WaitingMessageRecord = {
      id: uuid(),
      buffer_id: bufferId,
      identifier,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      type,
      received_at: new Date().toISOString(),
    };
    await getDatabase()('waiting_messages').insert(record);
    return record;
  }

  async dequeue(bufferId: string): Promise<WaitingMessageRecord | undefined> {
    const item = await getDatabase()('waiting_messages')
      .where({ buffer_id: bufferId })
      .orderBy('received_at', 'asc')
      .first();
    if (item) {
      await getDatabase()('waiting_messages').where({ id: item.id }).delete();
    }
    return item;
  }

  async countByBuffer(bufferId: string): Promise<number> {
    const result = await getDatabase()('waiting_messages')
      .where({ buffer_id: bufferId })
      .count('* as count')
      .first();
    return Number(result?.count || 0);
  }

  async findNextByBuffer(bufferId: string): Promise<WaitingMessageRecord | undefined> {
    return getDatabase()('waiting_messages')
      .where({ buffer_id: bufferId })
      .orderBy('received_at', 'asc')
      .first();
  }
}
