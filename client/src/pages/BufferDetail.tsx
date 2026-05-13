import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, BufferData, LogData, WindowData } from '../api/client';

export function BufferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [buffer, setBuffer] = useState<BufferData | null>(null);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [windows, setWindows] = useState<WindowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmingId, setConfirmingId] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (bufferId: string, isInitial: boolean) => {
    if (isInitial) setLoading(true);
    try {
      const [buf, logData, winData] = await Promise.all([
        api.buffers.get(bufferId),
        api.buffers.logs(bufferId),
        api.buffers.windows(bufferId, 'closed').catch(() => [] as WindowData[]),
      ]);
      setBuffer(buf);
      setLogs(logData);
      setWindows(winData);
      const now = new Date();
      setLastUpdate(now);
    } catch (err) {
      if (isInitial) setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!id) return;
    fetchData(id, true);
    const interval = setInterval(() => fetchData(id, false), 5000);
    return () => clearInterval(interval);
  }, [id, fetchData]);

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(''), 1500);
    });
  }, []);

  const handleConfirm = async (windowId: string) => {
    if (!buffer) return;
    setConfirmingId(windowId);
    try {
      await api.buffers.confirmWindow(buffer.id, windowId);
      setWindows(prev => prev.filter(w => w.id !== windowId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar consumo');
    } finally {
      setConfirmingId('');
    }
  };

  if (loading) return <div className="loading">Carregando...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!buffer) return <div className="alert alert-error">Buffer não encontrado</div>;

  const lastUpdateText = lastUpdate
    ? `Última atualização: ${lastUpdate.toLocaleTimeString('pt-BR')}`
    : '';

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>
            &larr; Voltar
          </button>
          <h2>{buffer.name}</h2>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate(`/buffers/${buffer.id}/edit`)}
        >
          Editar
        </button>
      </div>

      <div className="detail-card">
        <h3>Configuração</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">ID</span>
            <div className="api-key-row">
              <code>{buffer.id}</code>
              <button className="btn btn-xs btn-ghost" onClick={() => copyToClipboard(buffer.id, 'id')}>
                {copied === 'id' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className="detail-item">
            <span className="detail-label">Janela</span>
            <span>{buffer.window_time}s</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Limite de Janelas</span>
            <span>{buffer.max_concurrent_windows ?? 'Ilimitado'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Confirmação</span>
            <span>{buffer.require_consumption ? `Sim (timeout: ${buffer.consumption_timeout ?? '∞'}ms)` : 'Não'}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Timeout Webhook</span>
            <span>{buffer.webhook_timeout}ms</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Webhook</span>
            <span className="truncate">{buffer.webhook_url}</span>
          </div>
          <div className="detail-item detail-item-full">
            <span className="detail-label">API Key</span>
            <div className="api-key-row">
              <code>{buffer.api_key}</code>
              <button className="btn btn-xs btn-ghost" onClick={() => copyToClipboard(buffer.api_key, 'apiKey')}>
                {copied === 'apiKey' ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <div className="detail-item">
            <span className="detail-label">Criado em</span>
            <span>{new Date(buffer.created_at).toLocaleString('pt-BR')}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Atualizado em</span>
            <span>{new Date(buffer.updated_at).toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      <div className="detail-card">
        <h3>Endpoint de Ingestão</h3>
        <div className="endpoint-box" style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <code style={{flex:1}}>POST {window.location.origin}/api/ingest/{buffer.id}</code>
          <button className="btn btn-xs" style={{background:'rgba(255,255,255,0.15)',color:'#fff',borderColor:'rgba(255,255,255,0.3)'}} onClick={() => copyToClipboard(`${window.location.origin}/api/ingest/${buffer.id}`, 'endpoint')}>
            {copied === 'endpoint' ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="endpoint-desc">
          Envie mensagens para este buffer usando o header <code>X-Api-Key</code> com a API Key acima.
        </p>
      </div>

      {!!buffer.require_consumption && (
        <div className="detail-card">
          <div className="logs-header">
            <h3>Confirmações Pendentes</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastUpdateText}</span>
          </div>
          {windows.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma confirmação pendente.</p>
            </div>
          ) : (
            <div style={{ marginTop: 12 }}>
              {windows.map(w => (
                <div key={w.id} className="log-entry" style={{
                  borderLeft: '4px solid #d97706',
                  marginBottom: 8,
                }}>
                  <div className="log-header">
                    <span className="log-identifier">{w.identifier}</span>
                    <span className="status-badge closed">Pendente</span>
                    <span className="log-time">
                      {new Date(w.created_at).toLocaleString('pt-BR')}
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleConfirm(w.id)}
                      disabled={confirmingId === w.id}
                      style={{ marginLeft: 'auto', padding: '2px 12px', fontSize: '0.75rem' }}
                    >
                      {confirmingId === w.id ? 'Confirmando...' : 'Confirmar Consumo'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="detail-card">
        <div className="logs-header">
          <h3>Logs de Processamento</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastUpdateText}</span>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum log de processamento ainda.</p>
            <p className="text-muted">
              Os logs aparecerão aqui após as janelas expirarem e os webhooks forem chamados.
            </p>
          </div>
        ) : (
          <div className="logs-timeline">
            {logs.map((log) => {
              let payload: unknown;
              try { payload = JSON.parse(log.webhook_payload); } catch { payload = log.webhook_payload; }
              return (
                <div key={log.id} className="log-entry">
                  <div className="log-header">
                    <span className="log-identifier">{log.identifier}</span>
                    <span className="log-status" data-status={log.webhook_response_status && log.webhook_response_status < 400 ? 'success' : 'error'}>
                      HTTP {log.webhook_response_status ?? 'Falha'}
                    </span>
                    <span className="log-time">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  <details className="log-details">
                    <summary>Ver payload enviado</summary>
                    <pre className="log-payload">{JSON.stringify(payload, null, 2)}</pre>
                    {log.webhook_response_body && (
                      <>
                        <p className="log-response-label">Resposta do webhook:</p>
                        <pre className="log-payload">{log.webhook_response_body}</pre>
                      </>
                    )}
                  </details>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
