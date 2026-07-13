import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAnalyticsSummary, getDevices } from '../api/client';

export default function Overview() {
  const [analytics, setAnalytics] = useState(null);
  const [devices, setDevices] = useState([]);

  const load = useCallback(async () => {
    const [a, d] = await Promise.allSettled([getAnalyticsSummary(), getDevices()]);
    if (a.status === 'fulfilled') setAnalytics(a.value);
    if (d.status === 'fulfilled') setDevices(d.value);
  }, []);

  useEffect(() => { load(); const timer = setInterval(load, 20000); return () => clearInterval(timer); }, [load]);

  const connected = devices.filter((device) => device.is_connected);
  const total = analytics ? Object.values(analytics).reduce((sum, value) => sum + value, 0) : 0;

  return (
    <div className="overview-page">
      <section className="page-intro">
        <div><p className="eyebrow">Live gateway</p><h1>Good to see you.</h1><p>Your message queue and connected phones, in one place.</p></div>
        <Link to="/messages" className="btn btn-primary btn-fit">Send a message <span>→</span></Link>
      </section>

      <section className="metric-strip" aria-label="Message analytics">
        <article className="metric-feature"><span>Delivery overview</span><strong>{analytics?.sent ?? '—'}</strong><p>messages delivered successfully</p></article>
        <article><span>Pending</span><strong>{analytics?.pending ?? '—'}</strong><small>Waiting for a phone</small></article>
        <article><span>In progress</span><strong>{analytics?.dispatched ?? '—'}</strong><small>Claimed by a device</small></article>
        <article><span>Failed</span><strong>{analytics?.failed ?? '—'}</strong><small>Ready to review</small></article>
      </section>

      <div className="overview-columns">
        <section className="panel quota-panel"><div className="panel-heading"><div><p className="eyebrow">Getting started</p><h2>Send your first message</h2></div><Link to="/messages">Open sender</Link></div><div className="setup-steps"><p><span>1</span> Pair your Android phone under Devices.</p><p><span>2</span> Send a test SMS from Messages.</p><p><span>3</span> Create an API key and connect your project.</p></div><Link className="docs-link" to="/help">Read the complete setup guide →</Link></section>

        <section className="panel devices-panel">
          <div className="panel-heading"><div><p className="eyebrow">Sending nodes</p><h2>Connected phones</h2></div><Link to="/devices">Manage</Link></div>
          {connected.length ? connected.map((device) => (
            <div className="device-line" key={device.id}><span className="phone-glyph">▯</span><div><strong>{device.name}</strong><small>{device.model} · {device.messages_sent} claimed</small></div><i title="Connected" /></div>
          )) : <div className="guided-empty"><strong>No phone online</strong><p>Pair an Android phone to begin delivering queued messages.</p><Link to="/devices">Set up a device →</Link></div>}
        </section>
      </div>

      <footer className="overview-foot"><span>{total} messages recorded</span><span>Updates every 20 seconds</span></footer>
    </div>
  );
}
