import { WaitingMessageRecord } from '../models/types.js';
import { v4 as uuid } from 'uuid';
import { getRedis } from '../database/redis.js';
import { RedisService } from '../services/redis.service.js';

export class WaitingRepository {
  private getIdentifiersKey(bufferId: string) { return `buffer:${bufferId}:waiting_identifiers`; }
  private getMessagesKey(bufferId: string, identifier: string) { return `buffer:${bufferId}:waiting:${identifier}`; }

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
      content: JSON.stringify(content),
      type,
      received_at: new Date().toISOString(),
    };
    
    const redis = getRedis();
    const len = await redis.rpush(this.getMessagesKey(bufferId, identifier), JSON.stringify(record));
    
    // Se é a primeira mensagem desse identificador, adicionamos ele na fila de espera global do buffer
    if (len === 1) {
      await redis.rpush(this.getIdentifiersKey(bufferId), identifier);
    }
    
    return record;
  }

  async countByBuffer(bufferId: string): Promise<number> {
    const redis = getRedis();
    const identifiers = await redis.lrange(this.getIdentifiersKey(bufferId), 0, -1);
    let total = 0;
    for (const id of identifiers) {
      total += await redis.llen(this.getMessagesKey(bufferId, id));
    }
    return total;
  }

  async popNextUnlockedIdentifier(bufferId: string, redisService: RedisService): Promise<string | null> {
    const redis = getRedis();
    const identifiers = await redis.lrange(this.getIdentifiersKey(bufferId), 0, -1);
    
    for (const id of identifiers) {
      const blocked = await redisService.isBlocked(bufferId, id);
      if (!blocked) {
        await redis.lrem(this.getIdentifiersKey(bufferId), 1, id);
        return id;
      }
    }
    return null;
  }

  async dequeueByIdentifier(bufferId: string, identifier: string): Promise<WaitingMessageRecord[]> {
    const redis = getRedis();
    const key = this.getMessagesKey(bufferId, identifier);
    const msgsStr = await redis.lrange(key, 0, -1);
    await redis.del(key);
    
    return msgsStr.map(str => {
      const parsed = JSON.parse(str);
      return {
        ...parsed,
        identifier // garantir que o objeto de retorno tem o identificador
      };
    });
  }

  async clearBuffer(bufferId: string): Promise<void> {
    const redis = getRedis();
    const identifiers = await redis.lrange(this.getIdentifiersKey(bufferId), 0, -1);
    const pipeline = redis.pipeline();
    pipeline.del(this.getIdentifiersKey(bufferId));
    for (const id of identifiers) {
      pipeline.del(this.getMessagesKey(bufferId, id));
    }
    await pipeline.exec();
  }
}
