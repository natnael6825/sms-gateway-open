import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import AuthShell from '../components/AuthShell';

export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const navigate = useNavigate();
  async function handleSubmit(event) {
    event.preventDefault(); setError(''); setLoading(true);
    try { const { data } = await client.post('/api/auth/login', { email, password }); localStorage.setItem('token', data.token); localStorage.setItem('mustChangePassword', String(Boolean(data.must_change_password))); navigate(data.must_change_password ? '/change-password' : '/'); }
    catch (err) { setError(err.response?.data?.error || 'Sign in failed. Check your details and backend connection.'); }
    finally { setLoading(false); }
  }
  return <AuthShell><p className="eyebrow">Welcome back</p><h2>Sign in to your gateway</h2><p className="subtitle">Monitor delivery and keep your message queue moving.</p>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    <form onSubmit={handleSubmit}><div className="form-group"><label htmlFor="email">Email address</label><input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></div>
    <div className="form-group"><label htmlFor="password">Password</label><input id="password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></div>
    <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}<span>→</span></button></form>
    <p className="auth-link">Use the owner credentials configured on your server.</p></AuthShell>;
}
