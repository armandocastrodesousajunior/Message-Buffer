import { getDatabase } from '../database/connection.js';
import { BufferRecord, CreateBufferInput, UpdateBufferInput } from '../models/types.js';
import { v4 as uuid } from 'uuid';
import { env } from '../config/env.js';

interface CacheEntry {
  record: BufferRecord;
  expiresAt: number;
}

interface FindAllCacheEntry {
  records: BufferRecord[];
  expiresAt: number;
}

export class BufferRepository {
  // Cache individual por buffer ID — TTL configurável via BUFFER_CACHE_TTL_SECONDS
  private cache = new Map<string, CacheEntry>();
  // Cache para findAll() — TTL fixo de 5s para não sobrecarregar o sweeper
  private findAllCache: FindAllCacheEntry | null = null;
  private readonly ttlMs: number;
  private readonly findAllTtlMs = 5_000;

  constructor() {
    this.ttlMs = env.bufferCacheTtl * 1000;
  }

  private mapBuffer(row: any): BufferRecord {
    return { ...row, require_consumption: !!row.require_consumption };
  }

  private setCache(record: BufferRecord): void {
    this.cache.set(record.id, {
      record,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  invalidateCache(id: string): void {
    this.cache.delete(id);
    this.findAllCache = null; // Invalida o findAll também
  }

  invalidateAllCache(): void {
    this.cache.clear();
    this.findAllCache = null;
  }

  async findAll(): Promise<BufferRecord[]> {
    // Cache de curta duração para o sweeper (evita query a cada 1s)
    if (this.findAllCache && this.findAllCache.expiresAt > Date.now()) {
      return this.findAllCache.records;
    }

    const rows = await getDatabase()('buffers').orderBy('created_at', 'desc');
    const records = rows.map(r => this.mapBuffer(r));

    // Atualiza o cache individual de cada buffer junto com o findAll
    for (const record of records) {
      this.setCache(record);
    }

    this.findAllCache = { records, expiresAt: Date.now() + this.findAllTtlMs };
    return records;
  }

  async findById(id: string): Promise<BufferRecord | undefined> {
    const cached = this.cache.get(id);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.record; // Cache HIT
    }

    const row = await getDatabase()('buffers').where({ id }).first();
    if (!row) return undefined;

    const record = this.mapBuffer(row);
    this.setCache(record); // Salva no cache para próximas chamadas
    return record;
  }

  async findByApiKey(apiKey: string): Promise<BufferRecord | undefined> {
    // Verifica no cache primeiro antes de ir ao banco
    for (const entry of this.cache.values()) {
      if (entry.expiresAt > Date.now() && entry.record.api_key === apiKey) {
        return entry.record; // Cache HIT por api_key
      }
    }

    const row = await getDatabase()('buffers').where({ api_key: apiKey }).first();
    if (!row) return undefined;

    const record = this.mapBuffer(row);
    this.setCache(record);
    return record;
  }

  async create(input: CreateBufferInput): Promise<BufferRecord> {
    const now = new Date().toISOString();
    const record: BufferRecord = {
      id: input.id || uuid(),
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
    this.setCache(record); // Já coloca no cache após criação
    this.findAllCache = null; // Invalida findAll
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
    
    // Invalida o cache para forçar leitura fresca do banco
    this.invalidateCache(id);
    
    return this.findById(id); // Lê do banco e já repovoará o cache
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await getDatabase()('buffers').where({ id }).delete();
    this.invalidateCache(id); // Remove do cache imediatamente
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

