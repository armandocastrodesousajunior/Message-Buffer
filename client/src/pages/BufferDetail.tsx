import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, BufferData, LogData } from '../api/client';

export function BufferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [buffer, setBuffer] = useState<BufferData | null>(null);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  const loadData = async (bufferId: string) => {
    try {
      setLoading(true);
      const [buf, logData] = await Promise.all([
        api.buffers.get(bufferId),
        api.buffers.logs(bufferId),
      ]);
      setBuffer(buf);
      setLogs(logData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(field);
      setTimeout(() => setCopied(''), 1500);
    });
  }, []);

  if (loading) return <div className="loading">Carregando...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!buffer) return <div className="alert alert-error">Buffer não encontrado</div>;

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

      <div className="detail-card">
        <div className="logs-header">
          <h3>Logs de Processamento</h3>
          <button className="btn btn-sm btn-outline" onClick={() => loadData(buffer.id)}>
            Atualizar
          </button>
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
