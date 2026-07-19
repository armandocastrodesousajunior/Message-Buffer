import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, BufferData, LogData, WindowData } from '../api/client';

export function BufferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [buffer, setBuffer] = useState<BufferData | null>(null);
  const [logs, setLogs] = useState<LogData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);
  const [windows, setWindows] = useState<WindowData[]>([]);
  const [stats, setStats] = useState({ openWindows: 0, waitingMessages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [confirmingId, setConfirmingId] = useState('');
  const [clearTarget, setClearTarget] = useState<'open' | 'waiting' | 'consumption' | 'all' | null>(null);
  const [resetting, setResetting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchData = useCallback(async (bufferId: string, isInitial: boolean, currentPage: number) => {
    if (isInitial) setLoading(true);
    try {
      const [buf, logResp, winData, statsData] = await Promise.all([
        api.buffers.get(bufferId),
        api.buffers.logs(bufferId, currentPage, 25),
        api.buffers.windows(bufferId, 'closed').catch(() => [] as WindowData[]),
        api.buffers.stats(bufferId).catch(() => ({ openWindows: 0, waitingMessages: 0 })),
      ]);
      setBuffer(buf);
      setLogs(logResp.data);
      setTotalPages(logResp.totalPages);
      setTotalLogs(logResp.total);
      setWindows(winData);
      setStats(statsData);
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
    fetchData(id, true, page);
    const interval = setInterval(() => fetchData(id, false, page), 5000);
    return () => clearInterval(interval);
  }, [id, fetchData, page]);

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

  const handleClear = async () => {
    if (!buffer || !clearTarget) return;
    setResetting(true);
    try {
      if (clearTarget === 'all') {
        await api.buffers.resetData(buffer.id);
      } else if (clearTarget === 'open') {
        await api.buffers.clearOpenWindows(buffer.id);
      } else if (clearTarget === 'waiting') {
        await api.buffers.clearWaitingMessages(buffer.id);
      } else if (clearTarget === 'consumption') {
        await api.buffers.clearAwaitingConsumption(buffer.id);
      }
      setPage(1);
      await fetchData(buffer.id, true, 1);
      setClearTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao realizar a limpeza');
    } finally {
      setResetting(false);
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn"
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
            onClick={() => setClearTarget('all')}
          >
            Limpar Buffer
          </button>
          <button
            className="btn btn-primary"
            onClick={() => navigate(`/buffers/${buffer.id}/edit`)}
          >
            Editar
          </button>
        </div>
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
            <span className="detail-label">Limite de Resets</span>
            <span>{buffer.max_resets ?? 'Ilimitado'}</span>
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
        <div className="logs-header">
          <h3>Monitoramento em Tempo Real</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lastUpdateText}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.openWindows}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>Janelas Abertas</div>
            {stats.openWindows > 0 && (
              <button 
                className="btn btn-xs" 
                style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', border: 'none' }}
                onClick={() => setClearTarget('open')}
              >
                🧹 Limpar
              </button>
            )}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d97706' }}>{stats.waitingMessages}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>Mensagens na Fila</div>
            {stats.waitingMessages > 0 && (
              <button 
                className="btn btn-xs" 
                style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', border: 'none' }}
                onClick={() => setClearTarget('waiting')}
              >
                🧹 Limpar
              </button>
            )}
          </div>
          {!!buffer.require_consumption && (
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', textAlign: 'center', position: 'relative' }}>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>{windows.length}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 8 }}>Aguardando Consumo</div>
              {windows.length > 0 && (
                <button 
                  className="btn btn-xs" 
                  style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', border: 'none' }}
                  onClick={() => setClearTarget('consumption')}
                >
                  🧹 Limpar
                </button>
              )}
            </div>
          )}
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

        {totalPages > 1 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={page <= 1} 
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Anterior
            </button>
            <span className="text-muted" style={{ fontSize: '0.875rem' }}>
              Página {page} de {totalPages} ({totalLogs} logs)
            </span>
            <button 
              className="btn btn-sm btn-ghost" 
              disabled={page >= totalPages} 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Próximo
            </button>
          </div>
        )}
      </div>

      {clearTarget && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>
              ⚠️ {clearTarget === 'all' ? 'Limpar Buffer' : 'Limpeza Parcial'}
            </h3>
            <p>
              {clearTarget === 'all' && 'Você está prestes a apagar TODOS os logs de processamento, janelas abertas e mensagens na fila deste buffer.'}
              {clearTarget === 'open' && 'Você está prestes a interromper e apagar TODAS as janelas que estão ativas no momento.'}
              {clearTarget === 'waiting' && 'Você está prestes a apagar TODAS as mensagens que estão presas na fila aguardando processamento.'}
              {clearTarget === 'consumption' && 'Você está prestes a descartar TODAS as janelas que já foram enviadas mas ainda não foram consumidas.'}
            </p>
            <p className="text-muted" style={{ marginBottom: 24 }}>
              Esta ação é irreversível e dados não processados serão perdidos. Deseja continuar?
            </p>
            <div className="form-actions">
              <button 
                className="btn btn-ghost" 
                onClick={() => setClearTarget(null)}
                disabled={resetting}
              >
                Cancelar
              </button>
              <button 
                className="btn" 
                style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                onClick={handleClear}
                disabled={resetting}
              >
                {resetting ? 'Limpando...' : 'Sim, Limpar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
