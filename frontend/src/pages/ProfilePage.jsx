import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function ProfilePage() {
  const navigate = useNavigate();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  async function handleChangePassword(e) {
    e.preventDefault();
    setMsg(null);

    if (newPw !== confirmPw) {
      setMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPw.length < 12) {
      setMsg({ type: 'error', text: 'New password must be at least 12 characters.' });
      return;
    }

    setSaving(true);
    try {
      await client.post('/api/user/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      setMsg({ type: 'success', text: 'Password updated successfully.' });
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.error ?? 'Failed to update password.' });
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    navigate('/login');
  }

  return (
    <div>
      <h1 style={s.h1}>Profile</h1>

      <div style={s.card}>
        <div style={s.cardTitle}>Change Password</div>
        <form onSubmit={handleChangePassword} style={s.form}>
          <label style={s.label}>Current Password</label>
          <input style={s.input} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required />

          <label style={s.label}>New Password</label>
          <input style={s.input} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required />

          <label style={s.label}>Confirm New Password</label>
          <input style={s.input} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />

          {msg && (
            <div style={{ color: msg.type === 'error' ? '#ef4444' : '#22c55e', fontSize: 13 }}>
              {msg.text}
            </div>
          )}

          <button style={s.btn} type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Account</div>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 0 }}>
          Sign out of your account on this browser.
        </p>
        <button style={s.btnDanger} onClick={logout}>Sign Out</button>
      </div>
    </div>
  );
}

const s = {
  h1: { fontSize: 24, fontWeight: 700, color: '#1e293b', marginBottom: 24, marginTop: 0 },
  card: { background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', marginBottom: 20, maxWidth: 480 },
  cardTitle: { fontWeight: 600, fontSize: 15, color: '#1e293b', marginBottom: 16 },
  form: { display: 'flex', flexDirection: 'column', gap: 10 },
  label: { fontSize: 13, fontWeight: 600, color: '#475569' },
  input: { padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none' },
  btn: { padding: '10px 20px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14, alignSelf: 'flex-start', marginTop: 4 },
  btnDanger: { padding: '10px 20px', border: '1px solid #fecaca', borderRadius: 8, background: '#fff', color: '#ef4444', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
};
