import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Overview from './pages/Overview';
import MessagesPage from './pages/MessagesPage';
import DevicesPage from './pages/DevicesPage';
import DeviceDetailsPage from './pages/DeviceDetailsPage';
import ApiPage from './pages/ApiPage';
import ApiKeyDetailsPage from './pages/ApiKeyDetailsPage';
import ProfilePage from './pages/ProfilePage';
import Layout from './components/Layout';
import FirstLoginPassword from './pages/FirstLoginPassword';
import HelpPage from './pages/HelpPage';

function ProtectedRoute({ children, passwordPage = false }) {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;
  const mustChange = localStorage.getItem('mustChangePassword') === 'true';
  if (mustChange && !passwordPage) return <Navigate to="/change-password" replace />;
  if (!mustChange && passwordPage) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/change-password" element={<ProtectedRoute passwordPage><FirstLoginPassword /></ProtectedRoute>} />
        <Route path="/" element={<ProtectedRoute><Overview /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute><MessagesPage /></ProtectedRoute>} />
        <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
        <Route path="/devices/:id" element={<ProtectedRoute><DeviceDetailsPage /></ProtectedRoute>} />
        <Route path="/api" element={<ProtectedRoute><ApiPage /></ProtectedRoute>} />
        <Route path="/api/keys/:id" element={<ProtectedRoute><ApiKeyDetailsPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/help" element={<ProtectedRoute><HelpPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
