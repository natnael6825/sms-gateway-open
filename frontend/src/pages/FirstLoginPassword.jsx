import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function FirstLoginPassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError('');
    if (newPassword.length < 12) return setError('Use at least 12 characters for your permanent password.');
    if (newPassword !== confirmPassword) return setError('The new passwords do not match.');
    if (newPassword === currentPassword) return setError('Choose a password different from the temporary password.');
    setSaving(true);
    try {
      const { data } = await client.post('/api/user/change-password', { currentPassword, newPassword });
      if (data.token) localStorage.setItem('token', data.token);
      localStorage.removeItem('mustChangePassword');
      navigate('/', { replace: true });
    } catch (err) { setError(err.response?.data?.error || 'Could not change the password.'); }
    finally { setSaving(false); }
  }

  return <div className="first-login"><div className="first-login-card"><p className="eyebrow">One final step</p><h1>Choose your private password</h1><p>The password in your server configuration is temporary. Replace it before managing your gateway.</p>
    {error && <p className="alert alert-error" role="alert">{error}</p>}
    <form onSubmit={submit}><div className="form-group"><label htmlFor="current">Temporary password</label><input id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoFocus /></div>
    <div className="form-group"><label htmlFor="new">New password</label><input id="new" type="password" minLength={12} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required /></div>
    <div className="form-group"><label htmlFor="confirm">Confirm new password</label><input id="confirm" type="password" minLength={12} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required /></div>
    <button className="btn btn-primary" disabled={saving}>{saving ? 'Securing gateway…' : 'Save password and continue'}<span>→</span></button></form></div></div>;
}
