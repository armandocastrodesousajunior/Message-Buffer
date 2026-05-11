import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setAccessToken } from '../api/client';

export function Layout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    setAccessToken(null);
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path ? 'nav-link active' : 'nav-link';

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <h1 className="header-title" onClick={() => navigate('/')}>
            Message Buffer Manager
          </h1>
          <nav className="nav">
            <button className={isActive('/')} onClick={() => navigate('/')}>
              Buffers
            </button>
            <a href="/docs" className="nav-link">
              Documentação
            </a>
            <button className="nav-link" onClick={handleLogout}>
              Sair
            </button>
          </nav>
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
