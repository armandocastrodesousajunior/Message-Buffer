import { getRedis } from '../database/redis.js';
import { BufferRecord, WindowRecord } from '../models/types.js';

export class RedisService {
  // Configs
  private getTimerKey(bufferId: string) { return `buffer:${bufferId}:timers`; }
  private getConsumptionTimerKey(bufferId: string) { return `buffer:${bufferId}:consumption_timers`; }
  private getResetsKey(bufferId: string) { return `buffer:${bufferId}:resets`; }
  private getOpenWindowsKey(bufferId: string) { return `buffer:${bufferId}:open_windows`; }
  private getBlockedWindowsKey(bufferId: string) { return `buffer:${bufferId}:blocked_windows`; }
  private getActiveCountKey(bufferId: string) { return `buffer:${bufferId}:active_count`; }
  private getProcessQueueLockKey(bufferId: string) { return `buffer:${bufferId}:process_queue_lock`; }

  // --- Ingestion Flow ---

  async getOpenWindowId(bufferId: string, identifier: string): Promise<string | null> {
    return getRedis().hget(this.getOpenWindowsKey(bufferId), identifier);
  }

  async isBlocked(bufferId: string, identifier: string): Promise<boolean> {
    const exists = await getRedis().hexists(this.getBlockedWindowsKey(bufferId), identifier);
    return exists === 1;
  }

  async incrementAndCheckResets(bufferId: string, windowId: string, maxResets: number | null): Promise<boolean> {
    if (maxResets === null) return true; // unlimited
    const current = await getRedis().hincrby(this.getResetsKey(bufferId), windowId, 1);
    return current <= maxResets;
  }

  async updateWindowTimer(bufferId: string, windowId: string, expiresAtUnixMs: number): Promise<void> {
    await getRedis().zadd(this.getTimerKey(bufferId), expiresAtUnixMs, windowId);
  }

  async openWindow(bufferId: string, identifier: string, windowId: string, expiresAtUnixMs: number): Promise<void> {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.hset(this.getOpenWindowsKey(bufferId), identifier, windowId);
    pipeline.zadd(this.getTimerKey(bufferId), expiresAtUnixMs, windowId);
    pipeline.hset(this.getResetsKey(bufferId), windowId, 0);
    // Active count increment is handled explicitly as a semaphore before calling this method
    await pipeline.exec();
  }

  async getActiveWindowCount(bufferId: string): Promise<number> {
    const count = await getRedis().get(this.getActiveCountKey(bufferId));
    return count ? parseInt(count, 10) : 0;
  }

  async incrementActiveCount(bufferId: string): Promise<number> {
    return getRedis().incr(this.getActiveCountKey(bufferId));
  }

  async decrementActiveCount(bufferId: string): Promise<number> {
    return getRedis().decr(this.getActiveCountKey(bufferId));
  }

  async getOpenWindowCount(bufferId: string): Promise<number> {
    return getRedis().hlen(this.getOpenWindowsKey(bufferId));
  }

  /**
   * Tenta adquirir um lock exclusivo para o processQueue deste buffer.
   * Retorna true se adquiriu o lock (pode prosseguir), false se já está sendo processado.
   * O lock expira automaticamente em 30s para evitar deadlocks.
   */
  async acquireProcessQueueLock(bufferId: string): Promise<boolean> {
    const result = await getRedis().set(
      this.getProcessQueueLockKey(bufferId),
      '1',
      'EX', 30,
      'NX'
    );
    return result === 'OK';
  }

  async releaseProcessQueueLock(bufferId: string): Promise<void> {
    await getRedis().del(this.getProcessQueueLockKey(bufferId));
  }

  /**
   * Reconcilia o active_count com a realidade:
   * conta janelas realmente abertas (open_windows hash) + bloqueadas (blocked_windows hash).
   * Chame isso quando suspeitar de dessincronização.
   */
  async reconcileActiveCount(bufferId: string): Promise<number> {
    const redis = getRedis();
    const openCount = await redis.hlen(this.getOpenWindowsKey(bufferId));
    const blockedCount = await redis.hlen(this.getBlockedWindowsKey(bufferId));
    const realCount = openCount + blockedCount;
    await redis.set(this.getActiveCountKey(bufferId), realCount);
    return realCount;
  }

  async expireAllActiveWindows(bufferId: string): Promise<void> {
    const redis = getRedis();
    const timers = await redis.zrange(this.getTimerKey(bufferId), 0, -1);
    if (timers.length === 0) return;
    
    const pipeline = redis.pipeline();
    for (const winId of timers) {
      pipeline.zadd(this.getTimerKey(bufferId), 0, winId);
    }
    await pipeline.exec();
  }

  // --- Sweeper Flow ---

  async getExpiredWindows(bufferId: string, nowUnixMs: number): Promise<string[]> {
    return getRedis().zrangebyscore(this.getTimerKey(bufferId), 0, nowUnixMs);
  }

  async getExpiredConsumptionWindows(bufferId: string, nowUnixMs: number): Promise<string[]> {
    return getRedis().zrangebyscore(this.getConsumptionTimerKey(bufferId), 0, nowUnixMs);
  }

  async claimTimerLock(bufferId: string, windowId: string): Promise<boolean> {
    const removed = await getRedis().zrem(this.getTimerKey(bufferId), windowId);
    return removed === 1;
  }

  async claimConsumptionLock(bufferId: string, windowId: string): Promise<boolean> {
    const removed = await getRedis().zrem(this.getConsumptionTimerKey(bufferId), windowId);
    return removed === 1;
  }

  async closeWindow(bufferId: string, identifier: string, windowId: string, consumptionTimeoutMs: number | null): Promise<void> {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.hdel(this.getOpenWindowsKey(bufferId), identifier);
    pipeline.zrem(this.getTimerKey(bufferId), windowId);
    
    // Se exige consumo, vai para a lista de bloqueados
    pipeline.hset(this.getBlockedWindowsKey(bufferId), identifier, windowId);
    
    if (consumptionTimeoutMs !== null) {
      pipeline.zadd(this.getConsumptionTimerKey(bufferId), Date.now() + consumptionTimeoutMs, windowId);
    }
    
    await pipeline.exec();
  }

  private async enforceActiveCountFloor(bufferId: string): Promise<void> {
    const redis = getRedis();
    const countStr = await redis.get(this.getActiveCountKey(bufferId));
    if (countStr && parseInt(countStr, 10) < 0) {
      await redis.set(this.getActiveCountKey(bufferId), 0);
    }
  }

  async consumeWindow(bufferId: string, identifier: string, windowId: string): Promise<void> {
    const redis = getRedis();
    const removedOpen = await redis.hdel(this.getOpenWindowsKey(bufferId), identifier);
    const removedBlocked = await redis.hdel(this.getBlockedWindowsKey(bufferId), identifier);
    
    const pipeline = redis.pipeline();
    pipeline.zrem(this.getConsumptionTimerKey(bufferId), windowId);
    pipeline.hdel(this.getResetsKey(bufferId), windowId);
    
    if (removedOpen > 0 || removedBlocked > 0) {
      pipeline.decr(this.getActiveCountKey(bufferId));
    }
    await pipeline.exec();
    await this.enforceActiveCountFloor(bufferId);
  }

  async expireWindowWithoutConsumption(bufferId: string, identifier: string, windowId: string): Promise<void> {
    const redis = getRedis();
    const removedOpen = await redis.hdel(this.getOpenWindowsKey(bufferId), identifier);
    
    const pipeline = redis.pipeline();
    pipeline.zrem(this.getTimerKey(bufferId), windowId);
    pipeline.hdel(this.getResetsKey(bufferId), windowId);
    
    if (removedOpen > 0) {
      pipeline.decr(this.getActiveCountKey(bufferId));
    }
    await pipeline.exec();
    await this.enforceActiveCountFloor(bufferId);
  }

  async expireConsumptionTimeout(bufferId: string, identifier: string, windowId: string): Promise<void> {
    const redis = getRedis();
    const removedBlocked = await redis.hdel(this.getBlockedWindowsKey(bufferId), identifier);
    
    const pipeline = redis.pipeline();
    pipeline.zrem(this.getConsumptionTimerKey(bufferId), windowId);
    pipeline.hdel(this.getResetsKey(bufferId), windowId);
    
    if (removedBlocked > 0) {
      pipeline.decr(this.getActiveCountKey(bufferId));
    }
    await pipeline.exec();
    await this.enforceActiveCountFloor(bufferId);
  }

  async clearAllBufferData(bufferId: string): Promise<void> {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.del(this.getTimerKey(bufferId));
    pipeline.del(this.getConsumptionTimerKey(bufferId));
    pipeline.del(this.getResetsKey(bufferId));
    pipeline.del(this.getOpenWindowsKey(bufferId));
    pipeline.del(this.getBlockedWindowsKey(bufferId));
    pipeline.del(this.getActiveCountKey(bufferId));
    await pipeline.exec();
  }

  async clearOpenWindows(bufferId: string): Promise<void> {
    const redis = getRedis();
    const openWindows = await redis.hvals(this.getOpenWindowsKey(bufferId));
    const pipeline = redis.pipeline();
    
    pipeline.del(this.getTimerKey(bufferId));
    pipeline.del(this.getOpenWindowsKey(bufferId));
    
    for (const winId of openWindows) {
      pipeline.hdel(this.getResetsKey(bufferId), winId);
    }
    
    await pipeline.exec();
    
    // Recalcula activeCount exatamente para evitar números negativos
    const blockedCount = await redis.hlen(this.getBlockedWindowsKey(bufferId));
    await redis.set(this.getActiveCountKey(bufferId), blockedCount);
  }

  async clearWindowsAwaitingConsumption(bufferId: string): Promise<void> {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    
    pipeline.del(this.getConsumptionTimerKey(bufferId));
    pipeline.del(this.getBlockedWindowsKey(bufferId));
    
    await pipeline.exec();

    // Recalcula activeCount exatamente para evitar números negativos
    const openCount = await redis.hlen(this.getOpenWindowsKey(bufferId));
    await redis.set(this.getActiveCountKey(bufferId), openCount);
  }
}
