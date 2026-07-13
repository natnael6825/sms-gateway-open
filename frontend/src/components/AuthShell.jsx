import React, { useEffect, useState } from 'react';

export default function AuthShell({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem('theme', theme); }, [theme]);
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span className="brand-mark">S</span><strong>SignalDesk</strong></div>
        <div className="auth-pitch"><p className="eyebrow">Open-source SMS infrastructure</p><h1>Your Android phone.<br />Your messaging gateway.</h1><p>Deploy the API anywhere, pair a phone in minutes, and send application messages without handing your data to another platform.</p><ol><li><span>01</span>Deploy your backend</li><li><span>02</span>Pair an Android phone</li><li><span>03</span>Send from your project</li></ol></div>
        <p className="auth-footnote">Self-hosted · API-first · Built for Android</p>
      </section>
      <section className="auth-form-side">
        <button className="theme-toggle auth-theme" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? '☀ Light' : '☾ Dark'}</button>
        <div className="auth-card"><div className="mobile-auth-brand"><span className="brand-mark">S</span><strong>SignalDesk</strong></div>{children}</div>
        <p className="auth-security">Credentials are sent only to your configured backend.</p>
      </section>
    </main>
  );
}
