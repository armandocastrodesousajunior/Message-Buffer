import { MessageRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';
import { getRedis } from '../database/redis.js';

export class MessageRepository {
  private getKey(windowId: string) {
    return `window:${windowId}:messages`;
  }

  async findByWindow(windowId: string): Promise<MessageRecord[]> {
    const messagesStr = await getRedis().lrange(this.getKey(windowId), 0, -1);
    return messagesStr.map(str => JSON.parse(str));
  }

  async create(windowId: string, bufferId: string, identifier: string, content: unknown, type: string): Promise<MessageRecord> {
    const record: MessageRecord = {
      id: uuid(),
      window_id: windowId,
      buffer_id: bufferId,
      identifier,
      content: JSON.stringify(content),
      type,
      received_at: new Date().toISOString(),
    };
    await getRedis().rpush(this.getKey(windowId), JSON.stringify(record));
    return record;
  }

  async countByWindow(windowId: string): Promise<number> {
    return getRedis().llen(this.getKey(windowId));
  }

  async clearWindow(windowId: string): Promise<void> {
    await getRedis().del(this.getKey(windowId));
  }
}
