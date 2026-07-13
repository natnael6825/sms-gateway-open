import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createApiKey, getApiKeys } from '../api/client';

const BASE_URL = String(import.meta.env.VITE_API_URL || 'https://your-backend.com').replace(/\/+$/, '');
const EXAMPLE_MESSAGE_ID = '7b976a64-bb62-4c5f-8fa2-d63282113481';
const TERMINAL_STATUSES = ['sent', 'failed'];

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return <button type="button" className="api-copy" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>;
}

function CodeSamples({ samples, active, onChange, label }) {
  return <>
    <div className="code-tabs" role="tablist" aria-label={label}>
      {Object.keys(samples).map(item => <button type="button" role="tab" aria-selected={active === item} className={active === item ? 'active' : ''} key={item} onClick={() => onChange(item)}>{item}</button>)}
    </div>
    <div className="api-code"><CopyButton value={samples[active]} /><pre>{samples[active]}</pre></div>
  </>;
}

function ResponseViewer({ response, id }) {
  if (!response) return null;
  return <div id={id} className={`api-response ${response.ok ? 'success' : 'error'}`} aria-live="polite">
    <div><strong>Server response</strong><span>{response.status}</span></div>
    <pre>{JSON.stringify(response.body, null, 2)}</pre>
  </div>;
}

export default function ApiPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('My application');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [phone, setPhone] = useState('+251900000000');
  const [message, setMessage] = useState('Hello from SignalDesk');
  const [executing, setExecuting] = useState(false);
  const [response, setResponse] = useState(null);
  const [tab, setTab] = useState('curl');
  const [statusId, setStatusId] = useState('');
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusResponse, setStatusResponse] = useState(null);
  const [statusTab, setStatusTab] = useState('curl');

  const loadKeys = useCallback(async () => {
    try { setKeys(await getApiKeys()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadKeys(); }, [loadKeys]);

  function closeCreate() { setShowCreate(false); }
  async function handleCreate() {
    setCreating(true);
    try {
      const data = await createApiKey(name);
      setNewKey(data.key);
      setAuthKey(data.key);
      await loadKeys();
      closeCreate();
    } finally { setCreating(false); }
  }

  async function execute() {
    setExecuting(true);
    setResponse(null);
    try {
      const result = await fetch(`${BASE_URL}/api/v1/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': authKey },
        body: JSON.stringify({ phone_number: phone, message_text: message }),
      });
      const body = await result.json().catch(() => null);
      setResponse({ status: result.status, ok: result.ok, body });
      if (result.ok && typeof body?.id === 'string') {
        setStatusId(body.id);
        setStatusResponse(null);
      }
      await loadKeys();
    } catch (error) {
      setResponse({ status: 'Network error', ok: false, body: { error: error.message } });
    } finally { setExecuting(false); }
  }

  async function executeStatus() {
    setCheckingStatus(true);
    setStatusResponse(null);
    try {
      const result = await fetch(`${BASE_URL}/api/v1/sms/${encodeURIComponent(statusId.trim())}`, {
        headers: { 'X-API-Key': authKey },
      });
      const body = await result.json().catch(() => null);
      setStatusResponse({ status: result.status, ok: result.ok, body });
      await loadKeys();
    } catch (error) {
      setStatusResponse({ status: 'Network error', ok: false, body: { error: error.message } });
    } finally { setCheckingStatus(false); }
  }

  const samples = useMemo(() => ({
    curl: `curl -X POST ${BASE_URL}/api/v1/sms/send \\\n  -H "Content-Type: application/json" \\\n  -H "X-API-Key: YOUR_API_KEY" \\\n  -d '{"phone_number":"${phone}","message_text":"${message}"}'`,
    javascript: `const response = await fetch('${BASE_URL}/api/v1/sms/send', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n    'X-API-Key': process.env.SMS_GATEWAY_KEY,\n  },\n  body: JSON.stringify({\n    phone_number: '${phone}',\n    message_text: '${message}',\n  }),\n});\n\nconst { id, status } = await response.json();\n// Save id to check the final result later.`,
    python: `import os, requests\n\nresponse = requests.post(\n    '${BASE_URL}/api/v1/sms/send',\n    headers={'X-API-Key': os.environ['SMS_GATEWAY_KEY']},\n    json={'phone_number': '${phone}', 'message_text': '${message}'}\n)\nresult = response.json()\nmessage_id = result['id']  # Save this UUID for status checks\nprint(result)`,
  }), [phone, message]);

  const statusReference = statusId.trim() || EXAMPLE_MESSAGE_ID;
  const statusSamples = useMemo(() => ({
    curl: `curl ${BASE_URL}/api/v1/sms/${statusReference} \\\n  -H "X-API-Key: YOUR_API_KEY"`,
    javascript: `const terminal = new Set(['sent', 'failed']);\n\nasync function waitForMessage(messageId) {\n  while (true) {\n    const response = await fetch(\n      \`${BASE_URL}/api/v1/sms/\${messageId}\`,\n      { headers: { 'X-API-Key': process.env.SMS_GATEWAY_KEY } }\n    );\n    if (!response.ok) throw new Error(\`Status check failed: \${response.status}\`);\n\n    const message = await response.json();\n    if (terminal.has(message.status)) return message;\n    await new Promise(resolve => setTimeout(resolve, 3000));\n  }\n}\n\nconst result = await waitForMessage('${statusReference}');`,
    python: `import os, time, requests\n\nmessage_id = '${statusReference}'\nheaders = {'X-API-Key': os.environ['SMS_GATEWAY_KEY']}\n\nwhile True:\n    response = requests.get(\n        f'${BASE_URL}/api/v1/sms/{message_id}',\n        headers=headers\n    )\n    response.raise_for_status()\n    message = response.json()\n    if message['status'] in ('sent', 'failed'):\n        break\n    time.sleep(3)\n\nprint(message)`,
  }), [statusReference]);

  const currentStatus = String(statusResponse?.body?.status || '').toLowerCase();
  const isTerminalResponse = statusResponse?.body?.terminal === true || TERMINAL_STATUSES.includes(currentStatus);

  return <div className="api-page">
    <header className="page-intro"><div><p className="eyebrow">Developer API</p><h1>API reference</h1><p>Queue messages, follow delivery, and manage credentials.</p></div><span className="api-version">v1</span></header>

    <section className="api-keys-panel">
      <div className="api-section-head"><div><h2>API keys</h2><p>Existing credentials remain active when another key is created.</p></div><button type="button" className="btn btn-primary btn-fit" onClick={() => setShowCreate(true)}>Create API key</button></div>
      {newKey && <div className="new-key-alert"><div><strong>Save this key now</strong><p>For security, the complete value is shown only once.</p><code>{newKey}</code></div><CopyButton value={newKey} /></div>}
      <div className="key-table"><div className="key-table-row key-table-header"><span>Name</span><span>Credential</span><span>Requests</span><span>Messages</span><span>Sent</span><span>Failed</span><span>Last used</span><span>Created</span><span aria-hidden="true" /></div>{loading ? <p className="api-empty">Loading keys...</p> : keys.length === 0 ? <p className="api-empty">No API keys yet. Create one when your integration is ready.</p> : keys.map(key => <div className="key-table-row" key={key.id}><strong>{key.name}</strong><code>{key.key_hint}</code><span>{Number(key.usage_count || 0).toLocaleString()}</span><span>{Number(key.message_count || 0).toLocaleString()}</span><span className="key-sent-count">{Number(key.sent_count || 0).toLocaleString()}</span><span className={Number(key.failed_count || 0) > 0 ? 'key-failed-count' : ''}>{Number(key.failed_count || 0).toLocaleString()}</span><span>{key.last_used_at ? new Date(key.last_used_at).toLocaleString() : 'Never'}</span><span>{new Date(key.created_at).toLocaleDateString()}</span><Link className="key-details-link" to={`/api/keys/${key.id}`} aria-label={`View activity for ${key.name}`}>Details</Link></div>)}</div>
    </section>

    {showCreate && <section className="api-create-panel"><p className="eyebrow">New credential</p><h2>Create an additional API key</h2><p>The new key does not replace or delete any existing key. Save it when it is revealed.</p><label>Key name<input value={name} onChange={event => setName(event.target.value)} maxLength={60} /></label><div className="reset-actions"><button type="button" className="btn btn-primary" onClick={handleCreate} disabled={creating || !name.trim()}>{creating ? 'Creating...' : 'Create and reveal key'}</button><button type="button" className="text-button" onClick={closeCreate}>Cancel</button></div></section>}

    <div className="api-operation-stack">
      <section className="swagger-operation" aria-labelledby="send-operation-title">
        <div className="operation-summary"><span className="method-post">POST</span><code id="send-operation-title">/api/v1/sms/send</code><p>Queue an SMS for a connected Android device</p></div>
        <div className="operation-body">
          <label className="swagger-auth" htmlFor="send-api-key"><span><strong>Authorization</strong><small>Header: X-API-Key</small></span><input id="send-api-key" type="password" autoComplete="off" placeholder="Paste a complete API key" value={authKey} onChange={event => setAuthKey(event.target.value)} /></label>
          <h3>Request body <span>application/json</span></h3>
          <div className="request-fields"><label>phone_number <em>required</em><input value={phone} onChange={event => setPhone(event.target.value)} /></label><label>message_text <em>required</em><textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={1600} /><small>{message.length} / 1600</small></label></div>
          <button type="button" className="execute-button" onClick={execute} disabled={executing || !authKey || !phone || !message} aria-describedby="send-response">{executing ? 'Executing...' : 'Execute request'}</button>
          <ResponseViewer id="send-response" response={response} />
          {response?.ok && statusId && <p className="api-response-followup"><span aria-hidden="true">↳</span> The returned UUID is ready in the status operation below.</p>}

          <h3>Accepted response <span>201 application/json</span></h3>
          <div className="api-code api-schema-example"><CopyButton value={`{\n  "id": "${EXAMPLE_MESSAGE_ID}",\n  "status": "pending",\n  "status_url": "/api/v1/sms/${EXAMPLE_MESSAGE_ID}"\n}`} /><pre>{`{\n  "id": "${EXAMPLE_MESSAGE_ID}",\n  "status": "pending",\n  "status_url": "/api/v1/sms/${EXAMPLE_MESSAGE_ID}"\n}`}</pre></div>
          <p className="response-explainer">A <code>201</code> confirms the message was queued. It does not confirm that Android sent it. Save <code>id</code> and check the status operation below.</p>

          <h3>Code samples</h3>
          <CodeSamples samples={samples} active={tab} onChange={setTab} label="Send message code samples" />
          <h3>Responses</h3><div className="response-list">{[['201','Message accepted; returns a UUID and pending status'],['400','Invalid request body'],['401','Missing or invalid API key'],['409','No connected Android device'],['422','Message exceeds 1600 characters']].map(([status, text]) => <div key={status}><code>{status}</code><span>{text}</span></div>)}</div>
        </div>
      </section>

      <section className="swagger-operation status-operation" aria-labelledby="status-operation-title">
        <div className="operation-summary"><span className="method-get">GET</span><code id="status-operation-title">/api/v1/sms/{'{id}'}</code><p>Read the latest message lifecycle status</p></div>
        <div className="operation-body">
          <label className="swagger-auth" htmlFor="status-api-key"><span><strong>Authorization</strong><small>Use the same X-API-Key that created the message</small></span><input id="status-api-key" type="password" autoComplete="off" placeholder="Paste a complete API key" value={authKey} onChange={event => setAuthKey(event.target.value)} /></label>

          <h3>Path parameter</h3>
          <div className="status-lookup-fields">
            <label htmlFor="message-status-id"><span>id <em>required · UUID</em></span><input id="message-status-id" inputMode="text" spellCheck="false" placeholder={EXAMPLE_MESSAGE_ID} value={statusId} onChange={event => { setStatusId(event.target.value); setStatusResponse(null); }} /></label>
            <button type="button" className="execute-button" onClick={executeStatus} disabled={checkingStatus || !authKey || !statusId.trim()} aria-describedby="status-response">{checkingStatus ? 'Checking...' : 'Check status'}</button>
          </div>
          <ResponseViewer id="status-response" response={statusResponse} />
          {statusResponse?.ok && <p className={`status-result-note ${isTerminalResponse ? 'terminal' : ''}`}>{isTerminalResponse ? <><strong>{currentStatus}</strong> is a final status. Stop polling this message.</> : <>This message is still moving through the queue. Check again in 2–5 seconds.</>}</p>}

          <div className="polling-guidance">
            <div><p className="eyebrow">Polling contract</p><h3>Follow the handoff, then stop</h3><p>Poll every 2–5 seconds while the message is <code>pending</code> or <code>dispatched</code>. Stop when it becomes <code>sent</code> or <code>failed</code>. Reuse this UUID; never submit the SMS again just to check it. Each poll increases the key’s Request metric, but never its Message or Sent counts.</p></div>
            <ol aria-label="Message status progression"><li><span>01</span><strong>pending</strong><small>Queued</small></li><li><span>02</span><strong>dispatched</strong><small>Phone claimed it</small></li><li><span>03</span><strong>sent / failed</strong><small>Terminal result</small></li></ol>
          </div>

          <h3>Code samples</h3>
          <CodeSamples samples={statusSamples} active={statusTab} onChange={setStatusTab} label="Check message status code samples" />

          <h3>Successful response <span>200 application/json</span></h3>
          <div className="api-code api-schema-example"><CopyButton value={`{\n  "id": "${EXAMPLE_MESSAGE_ID}",\n  "status": "sent",\n  "terminal": true,\n  "created_at": "2026-07-13T09:53:12.000Z",\n  "dispatched_at": "2026-07-13T09:53:46.000Z",\n  "send_started_at": "2026-07-13T09:53:47.000Z",\n  "completed_at": "2026-07-13T09:53:48.000Z",\n  "device": { "name": "Android Device" }\n}`} /><pre>{`{\n  "id": "${EXAMPLE_MESSAGE_ID}",\n  "status": "sent",\n  "terminal": true,\n  "created_at": "2026-07-13T09:53:12.000Z",\n  "dispatched_at": "2026-07-13T09:53:46.000Z",\n  "send_started_at": "2026-07-13T09:53:47.000Z",\n  "completed_at": "2026-07-13T09:53:48.000Z",\n  "device": { "name": "Android Device" }\n}`}</pre></div>
          <p className="response-explainer">Lifecycle timestamps remain <code>null</code> until that stage occurs. The <code>terminal</code> field tells your integration when polling can stop.</p>

          <h3>Responses</h3><div className="response-list">{[['200','Current status, lifecycle timestamps, and assigned device'],['400','Message ID is not a valid UUID'],['401','Missing or invalid API key'],['404','Message not found for this API key']].map(([status, text]) => <div key={status}><code>{status}</code><span>{text}</span></div>)}</div>
        </div>
      </section>
    </div>
  </div>;
}
