import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, BufferData } from '../api/client';

export function BufferList() {
  const [buffers, setBuffers] = useState<BufferData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadBuffers();
  }, []);

  const loadBuffers = async () => {
    try {
      setLoading(true);
      const data = await api.buffers.list();
      setBuffers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar buffers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Deletar o buffer "${name}"? Esta ação é irreversível.`)) return;
    try {
      await api.buffers.delete(id);
      setBuffers((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao deletar');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('API Key copiada!');
    });
  };

  if (loading) return <div className="loading">Carregando buffers...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>Buffers</h2>
        <button className="btn btn-primary" onClick={() => navigate('/buffers/new')}>
          + Novo Buffer
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {buffers.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum buffer cadastrado.</p>
          <button className="btn btn-primary" onClick={() => navigate('/buffers/new')}>
            Criar primeiro buffer
          </button>
        </div>
      ) : (
        <div className="buffer-grid">
          {buffers.map((buffer) => (
            <div key={buffer.id} className="buffer-card">
              <div className="buffer-card-header">
                <h3 className="buffer-card-name">{buffer.name}</h3>
                <div className="buffer-card-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => navigate(`/buffers/${buffer.id}/edit`)}
                    title="Editar"
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => handleDelete(buffer.id, buffer.name)}
                    title="Deletar"
                  >
                    Deletar
                  </button>
                </div>
              </div>

              <div className="buffer-card-body" onClick={() => navigate(`/buffers/${buffer.id}`)}>
                <div className="buffer-info">
                  <span className="info-label">Janela</span>
                  <span className="info-value">{buffer.window_time}s</span>
                </div>
                <div className="buffer-info">
                  <span className="info-label">Limite</span>
                  <span className="info-value">
                    {buffer.max_concurrent_windows ?? 'Ilimitado'}
                  </span>
                </div>
                <div className="buffer-info">
                  <span className="info-label">Webhook</span>
                  <span className="info-value info-value-truncate">{buffer.webhook_url}</span>
                </div>
                <div className="buffer-info">
                  <span className="info-label">API Key</span>
                  <span className="info-value info-value-key">
                    <code>{buffer.api_key.substring(0, 8)}...</code>
                    <button
                      className="btn btn-xs btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(buffer.api_key);
                      }}
                    >
                      Copiar
                    </button>
                  </span>
                </div>
              </div>

              <div className="buffer-card-footer">
                <span className="buffer-date">
                  Criado em {new Date(buffer.created_at).toLocaleString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
