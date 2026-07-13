import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDevices, getPairingCode, removeDevice, resetDeviceKey } from '../api/client';

const BACKEND_URL = String(import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const RESET_PHRASE = 'RESET ALL DEVICES';

function CopyValue({ value, label }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return <button className="device-copy" onClick={copy} disabled={!value}>{copied ? 'Copied' : `Copy ${label}`}</button>;
}

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [codeLoading, setCodeLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [showReset, setShowReset] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const loadDevices = useCallback(async () => {
    try { setDevices(await getDevices()); } finally { setLoading(false); }
  }, []);
  const loadCode = useCallback(async () => {
    setCodeLoading(true);
    try { const data = await getPairingCode(); setPairingCode(data.code); } finally { setCodeLoading(false); }
  }, []);

  useEffect(() => {
    loadDevices(); loadCode();
    const timer = setInterval(loadDevices, 15000);
    return () => clearInterval(timer);
  }, [loadDevices, loadCode]);

  function closeReset() { setShowReset(false); setAcknowledged(false); setConfirmation(''); }

  async function handleReset() {
    if (!acknowledged || confirmation !== RESET_PHRASE) return;
    if (!window.confirm('Final confirmation: revoke every paired phone and create a new pairing code?')) return;
    setResetting(true);
    try {
      const data = await resetDeviceKey(confirmation, acknowledged);
      setPairingCode(data.code);
      await loadDevices();
      closeReset();
    } finally { setResetting(false); }
  }

  async function handleRemove(id) {
    setRemoving(id);
    try { await removeDevice(id); await loadDevices(); } finally { setRemoving(null); }
  }

  const connected = devices.filter((device) => device.is_connected);
  const offline = devices.filter((device) => !device.is_connected);

  return <div className="devices-page">
    <header className="page-intro"><div><p className="eyebrow">Android senders</p><h1>Devices</h1><p>Connect and monitor the phones that deliver your messages.</p></div></header>

    <section className="pairing-panel">
      <div className="pairing-heading"><div><p className="eyebrow">Pair a phone</p><h2>Enter these details in the Android app</h2></div><span className="pairing-step">2 values</span></div>
      <div className="pairing-values">
        <div className="pairing-value"><span>1 · Backend URL</span><div><code>{BACKEND_URL || 'Set VITE_API_URL'}</code><CopyValue value={BACKEND_URL} label="URL" /></div><small>The phone must be able to reach this address. Do not use localhost from a physical phone.</small></div>
        <div className="pairing-value pairing-code"><span>2 · Pairing code</span><div><code>{codeLoading ? '•••••••' : pairingCode || '—'}</code><CopyValue value={pairingCode} label="code" /></div><small>This code stays valid until you deliberately reset it.</small></div>
      </div>
      <div className="pairing-foot"><p><strong>On your phone:</strong> open SignalDesk, paste the backend URL, enter the code, and grant SMS permission.</p><button className="danger-text" onClick={() => setShowReset(true)}>Reset pairing code</button></div>
    </section>

    {showReset && <section className="reset-panel" aria-labelledby="reset-title">
      <div><p className="eyebrow">Destructive action</p><h2 id="reset-title">Reset the pairing code?</h2><p>This immediately revokes every paired phone. Each device must be opened and paired again using the new code before messages can be sent.</p></div>
      <label className="reset-check"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /><span>I understand that all {devices.length} paired device{devices.length === 1 ? '' : 's'} will be disconnected.</span></label>
      <label className="reset-phrase">Type <strong>{RESET_PHRASE}</strong> to continue<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" /></label>
      <div className="reset-actions"><button className="btn-reset" onClick={handleReset} disabled={resetting || !acknowledged || confirmation !== RESET_PHRASE}>{resetting ? 'Resetting…' : 'Revoke devices and reset code'}</button><button className="text-button" onClick={closeReset} disabled={resetting}>Cancel</button></div>
    </section>}

    <section className="device-list-panel">
      <div className="device-list-title"><div><i className="online-dot" /><h2>Live devices</h2><span>{connected.length}</span></div><small>Refreshes every 15 seconds</small></div>
      {loading ? <p className="device-empty">Loading devices…</p> : connected.length === 0 ? <div className="device-empty"><strong>No phone is online</strong><p>Open the Android app on a paired phone and wait for it to check in.</p></div> : connected.map((device) => <DeviceRow key={device.id} device={device} onRemove={handleRemove} removing={removing} />)}
    </section>

    {offline.length > 0 && <section className="device-list-panel offline-list"><div className="device-list-title"><div><h2>Offline devices</h2><span>{offline.length}</span></div></div>{offline.map((device) => <DeviceRow key={device.id} device={device} onRemove={handleRemove} removing={removing} offline />)}</section>}
  </div>;
}

function DeviceRow({ device, onRemove, removing, offline = false }) {
  return <div className="device-record"><span className="phone-glyph">▯</span><div><strong>{device.name}</strong><small>{device.model} · paired {new Date(device.paired_at).toLocaleDateString()}</small><small>{device.claimed_count ?? 0} assigned · {device.sent_count ?? 0} sent · {device.failed_count ?? 0} failed</small>{device.last_seen && <small>Last seen {new Date(device.last_seen).toLocaleString()}</small>}</div><span className={`device-state ${offline ? 'offline' : ''}`}>{offline ? 'Offline' : 'Connected'}</span><Link className="device-details-link" to={`/devices/${device.id}`}>Details</Link><button className="remove-device" onClick={() => onRemove(device.id)} disabled={removing === device.id}>{removing === device.id ? 'Removing…' : 'Remove'}</button></div>;
}
