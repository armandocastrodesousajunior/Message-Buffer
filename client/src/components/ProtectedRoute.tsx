import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAccessToken } from '../api/client';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getAccessToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
