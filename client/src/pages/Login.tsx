import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '../api/client';

export function Login() {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/web/buffers', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setAccessToken(token);
        navigate('/');
      } else {
        setError('Token inválido. Verifique o ACCESS_TOKEN configurado no servidor.');
      }
    } catch {
      setError('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">Message Buffer Manager</h1>
        <p className="login-subtitle">Acesse o painel de gerenciamento</p>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="token">Token de Acesso</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Insira o ACCESS_TOKEN"
              required
              autoFocus
            />
          </div>
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
