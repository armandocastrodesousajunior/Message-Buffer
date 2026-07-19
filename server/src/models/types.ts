export interface BufferRecord {
  id: string;
  name: string;
  window_time: number;
  webhook_url: string;
  max_concurrent_windows: number | null;
  require_consumption: boolean;
  consumption_timeout: number | null;
  webhook_timeout: number;
  max_resets: number | null;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export interface WindowRecord {
  id: string;
  buffer_id: string;
  identifier: string;
  status: 'open' | 'processing' | 'closed' | 'consumed' | 'expired';
  reset_count: number;
  expires_at: string;
  created_at: string;
}

export interface MessageRecord {
  id: string;
  window_id: string;
  buffer_id: string;
  identifier: string;
  content: string;
  type: string;
  received_at: string;
}

export interface WaitingMessageRecord {
  id: string;
  buffer_id: string;
  identifier: string;
  content: string;
  type: string;
  received_at: string;
}

export interface LogRecord {
  id: string;
  buffer_id: string;
  window_id: string | null;
  identifier: string;
  webhook_payload: string;
  webhook_response_status: number | null;
  webhook_response_body: string | null;
  created_at: string;
}

export interface IngestRequest {
  identifier: string;
  content: unknown;
  type: 'string' | 'number' | 'boolean' | 'json';
}

export interface WebhookPayload {
  identifier: string;
  buffer_id: string;
  messages: Array<{
    content: unknown;
    type: string;
    received_at: string;
  }>;
}

export interface CreateBufferInput {
  name: string;
  window_time: number;
  webhook_url: string;
  max_concurrent_windows: number | null;
  require_consumption?: boolean;
  consumption_timeout?: number | null;
  webhook_timeout?: number;
  max_resets?: number | null;
}

export interface UpdateBufferInput {
  name?: string;
  window_time?: number;
  webhook_url?: string;
  max_concurrent_windows?: number | null;
  require_consumption?: boolean;
  consumption_timeout?: number | null;
  webhook_timeout?: number;
  max_resets?: number | null;
}
