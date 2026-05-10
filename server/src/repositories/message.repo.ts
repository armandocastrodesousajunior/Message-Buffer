import { getDatabase } from '../database/connection.js';
import { MessageRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';

export class MessageRepository {
  async create(
    windowId: string,
    bufferId: string,
    identifier: string,
    content: unknown,
    type: string
  ): Promise<MessageRecord> {
    const record: MessageRecord = {
      id: uuid(),
      window_id: windowId,
      buffer_id: bufferId,
      identifier,
      content: typeof content === 'string' ? content : JSON.stringify(content),
      type,
      received_at: new Date().toISOString(),
    };
    await getDatabase()('messages').insert(record);
    return record;
  }

  async findByWindowId(windowId: string): Promise<MessageRecord[]> {
    return getDatabase()('messages').where({ window_id: windowId }).orderBy('received_at', 'asc');
  }
}
