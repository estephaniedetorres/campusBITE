import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import HomePage from './apps/home/HomePage';
import KioskPage from './apps/kiosk/KioskPage';
import PosPage from './apps/pos/PosPage';
import KdsPage from './apps/kds/KdsPage';
import AdminPage from './apps/admin/AdminPage';
import LoginPage from './apps/auth/LoginPage';
import { AuthProvider } from './lib/auth';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/kds" element={<KdsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
