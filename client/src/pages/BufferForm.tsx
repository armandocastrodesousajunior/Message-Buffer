import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, BufferData } from '../api/client';

interface FormData {
  name: string;
  window_time: string;
  webhook_url: string;
  max_concurrent_windows: string;
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
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar buffer');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
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

        <div className="form-group">
          <label htmlFor="max_concurrent_windows">
            Limite de Janelas Simultâneas
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
          <span className="form-hint">
            Número máximo de janelas abertas ao mesmo tempo. Deixe vazio para ilimitado.
          </span>
        </div>

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
