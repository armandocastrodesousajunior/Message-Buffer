import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, BufferData } from '../api/client';

interface FormData {
  name: string;
  window_time: string;
  webhook_url: string;
  max_concurrent_windows: string;
  require_consumption: boolean;
  consumption_timeout: string;
  webhook_timeout: string;
}

export function BufferForm() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    name: '',
    window_time: '',
    webhook_url: '',
    max_concurrent_windows: '',
    require_consumption: false,
    consumption_timeout: '',
    webhook_timeout: '30000',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      loadBuffer(id);
    }
  }, [id]);

  const loadBuffer = async (bufferId: string) => {
    try {
      const buffer = await api.buffers.get(bufferId);
      setForm({
        name: buffer.name,
        window_time: String(buffer.window_time),
        webhook_url: buffer.webhook_url,
        max_concurrent_windows:
          buffer.max_concurrent_windows === null ? '' : String(buffer.max_concurrent_windows),
        require_consumption: buffer.require_consumption,
        consumption_timeout:
          buffer.consumption_timeout === null ? '' : String(buffer.consumption_timeout),
        webhook_timeout: String(buffer.webhook_timeout),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar buffer');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, type, value, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: form.name,
        window_time: parseInt(form.window_time, 10),
        webhook_url: form.webhook_url,
        max_concurrent_windows:
          form.max_concurrent_windows === '' ? null : parseInt(form.max_concurrent_windows, 10),
        require_consumption: form.require_consumption,
        consumption_timeout:
          form.consumption_timeout === '' ? null : parseInt(form.consumption_timeout, 10),
        webhook_timeout: parseInt(form.webhook_timeout, 10) || 30000,
      };

      if (isEditing) {
        await api.buffers.update(id!, payload);
      } else {
        await api.buffers.create(payload);
      }

      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar buffer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-page">
      <h2>{isEditing ? 'Editar Buffer' : 'Novo Buffer'}</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="form">
        <div className="form-group">
          <label htmlFor="name">Nome do Buffer</label>
          <input
            id="name"
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            placeholder="Ex: Meu Buffer de Produção"
            required
          />
          <span className="form-hint">Nome amigável para identificar o buffer no painel</span>
        </div>

        <div className="form-group">
          <label htmlFor="window_time">Tempo de Janela (segundos)</label>
          <input
            id="window_time"
            name="window_time"
            type="number"
            min="1"
            value={form.window_time}
            onChange={handleChange}
            placeholder="Ex: 30"
            required
          />
          <span className="form-hint">
            Tempo que a janela fica aberta aguardando mensagens do mesmo identifier
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="webhook_url">Webhook Destino</label>
          <input
            id="webhook_url"
            name="webhook_url"
            type="url"
            value={form.webhook_url}
            onChange={handleChange}
            placeholder="https://meuservidor.com/webhook"
            required
          />
          <span className="form-hint">URL que receberá o lote de mensagens ao expirar a janela</span>
        </div>

        <details style={{ marginTop: 24, marginBottom: 24 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: '#525252' }}>
            Opções avançadas
          </summary>
          <div style={{ marginTop: 20, padding: 20, background: '#fafafa', borderRadius: 8, border: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column', gap: 20 }}>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="max_concurrent_windows">
                Limite de Janelas Simultâneas
                <span className="tooltip-icon" title="Número máximo de janelas abertas ao mesmo tempo. Quando o limite é atingido, novas mensagens vão para a fila de espera."> ℹ️</span>
              </label>
              <input
                id="max_concurrent_windows"
                name="max_concurrent_windows"
                type="number"
                min="0"
                value={form.max_concurrent_windows}
                onChange={handleChange}
                placeholder="Deixe vazio para ilimitado"
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  name="require_consumption"
                  type="checkbox"
                  checked={form.require_consumption}
                  onChange={handleChange}
                  style={{ width: 18, height: 18 }}
                />
                Requerer confirmação de consumo
                <span className="tooltip-icon" title="Quando ativo, o identificador só libera para uma nova janela após a janela anterior ser confirmada (via webhook 200, rota de confirmação ou interface)."> ℹ️</span>
              </label>
            </div>

            {!!form.require_consumption && (
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="consumption_timeout">
                  Tempo de expiração da confirmação (ms)
                </label>
                <input
                  id="consumption_timeout"
                  name="consumption_timeout"
                  type="number"
                  min="0"
                  value={form.consumption_timeout}
                  onChange={handleChange}
                  placeholder="Deixe vazio para confirmação obrigatória sem prazo"
                />
                <span className="form-hint">Se preenchido, o sistema confirma automaticamente após este tempo sem resposta do webhook.</span>
              </div>
            )}

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="webhook_timeout">
                Timeout da requisição (ms)
                <span className="tooltip-icon" title="Tempo máximo de espera pela resposta do webhook de destino antes de considerar falha."> ℹ️</span>
              </label>
              <input
                id="webhook_timeout"
                name="webhook_timeout"
                type="number"
                min="1000"
                value={form.webhook_timeout}
                onChange={handleChange}
                placeholder="30000"
              />
              <span className="form-hint">Padrão: 30000ms (30 segundos)</span>
            </div>

          </div>
        </details>

        <div className="form-actions">
          <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar Buffer'}
          </button>
        </div>
      </form>
    </div>
  );
}
