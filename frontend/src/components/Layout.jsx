import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Overview', icon: '⌂' },
  { to: '/messages', label: 'Messages', icon: '↗' },
  { to: '/devices', label: 'Devices', icon: '▣' },
  { to: '/api', label: 'API access', icon: '{ }' },
  { to: '/help', label: 'Documentation', icon: '?' },
  { to: '/profile', label: 'Settings', icon: '○' },
];

function initialTheme() {
  return localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export default function Layout({ children }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('mustChangePassword');
    navigate('/login');
  }

  return (
    <div className="app-shell">
      {sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <NavLink to="/" className="brand" onClick={() => setSidebarOpen(false)}>
          <span className="brand-mark">S</span>
          <span><strong>SignalDesk</strong><small>SMS gateway</small></span>
        </NavLink>
        <nav className="primary-nav" aria-label="Main navigation">
          <p className="nav-eyebrow">Workspace</p>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setSidebarOpen(false)}>
              <span className="nav-icon">{icon}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="server-indicator"><i /> Backend configured</div>
          <button className="text-button" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">☰</button>
          <div className="topbar-context"><span>Operations</span><strong>Message workspace</strong></div>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={`Use ${theme === 'dark' ? 'light' : 'dark'} mode`}>
            {theme === 'dark' ? '☀ Light' : '☾ Dark'}
          </button>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
