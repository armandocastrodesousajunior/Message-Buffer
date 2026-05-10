const API_BASE = '/api/web';

let accessToken: string | null = sessionStorage.getItem('access_token');

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (token) {
    sessionStorage.setItem('access_token', token);
  } else {
    sessionStorage.removeItem('access_token');
  }
}

export function getAccessToken(): string | null {
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export interface BufferData {
  id: string;
  name: string;
  window_time: number;
  webhook_url: string;
  max_concurrent_windows: number | null;
  api_key: string;
  created_at: string;
  updated_at: string;
}

export interface CreateBufferInput {
  name: string;
  window_time: number;
  webhook_url: string;
  max_concurrent_windows: number | null;
}

export interface UpdateBufferInput {
  name?: string;
  window_time?: number;
  webhook_url?: string;
  max_concurrent_windows?: number | null;
}

export interface LogData {
  id: string;
  buffer_id: string;
  window_id: string | null;
  identifier: string;
  webhook_payload: string;
  webhook_response_status: number | null;
  webhook_response_body: string | null;
  created_at: string;
}

export const api = {
  buffers: {
    list: () => request<BufferData[]>('/buffers'),
    get: (id: string) => request<BufferData>(`/buffers/${id}`),
    create: (data: CreateBufferInput) =>
      request<BufferData>('/buffers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateBufferInput) =>
      request<BufferData>(`/buffers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<void>(`/buffers/${id}`, { method: 'DELETE' }),
    logs: (id: string) => request<LogData[]>(`/buffers/${id}/logs`),
  },
};
