import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { BufferList } from './pages/BufferList';
import { BufferForm } from './pages/BufferForm';
import { BufferDetail } from './pages/BufferDetail';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <BufferList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buffers/new"
          element={
            <ProtectedRoute>
              <Layout>
                <BufferForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buffers/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <BufferDetail />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/buffers/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <BufferForm />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
