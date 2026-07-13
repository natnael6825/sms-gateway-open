# HTTP API

The base URL is your deployed backend, such as `https://sms.example.com`. In the dashboard, open **API access**, create a key, and store the plaintext value immediately; only its SHA-256 hash remains on the server.

Send the API key with every request:

```http
X-API-Key: sms_...
```

Keep API keys on a server, never in public browser or mobile application code.

## Queue an SMS

`POST /api/v1/sms/send`

Headers: `X-API-Key: sms_...` and `Content-Type: application/json`.

```json
{
  "phone_number": "+251900000000",
  "message_text": "Your verification code is 482193"
}
```

A successful request returns HTTP 201:

```json
{
  "id": "7b976a64-bb62-4c5f-8fa2-d63282113481",
  "status": "pending",
  "status_url": "/api/v1/sms/7b976a64-bb62-4c5f-8fa2-d63282113481"
}
```

Save `id`. It is the public message UUID used for status checks. HTTP 201 confirms that the job entered the queue; it does not confirm that Android sent the SMS.

HTTP 401 means the key is missing or invalid. HTTP 409 with code `NO_CONNECTED_DEVICE` means no active phone has checked in during the last 60 seconds. HTTP 422 means the content is longer than 1600 characters.

## Check message status

`GET /api/v1/sms/{id}`

Use the message UUID returned by the send request and authenticate with the same `X-API-Key`.

```bash
curl https://sms.example.com/api/v1/sms/7b976a64-bb62-4c5f-8fa2-d63282113481 \
  -H "X-API-Key: sms_your_key"
```

The endpoint returns the current lifecycle state, timestamps, and assigned Android device when one exists:

```json
{
  "id": "7b976a64-bb62-4c5f-8fa2-d63282113481",
  "status": "sent",
  "terminal": true,
  "created_at": "2026-07-13T09:53:12.000Z",
  "dispatched_at": "2026-07-13T09:53:46.000Z",
  "send_started_at": "2026-07-13T09:53:47.000Z",
  "completed_at": "2026-07-13T09:53:48.000Z",
  "device": {
    "name": "Android Device"
  }
}
```

Lifecycle timestamps remain `null` until their stage occurs. HTTP 400 means the ID is not a UUID, HTTP 401 means the key is invalid, and HTTP 404 means that message does not exist for the authenticated key.

## Poll until completion

Poll every 2–5 seconds while the status is `pending` or `dispatched`. Stop when `terminal` is `true`, which corresponds to `sent` or `failed`. Reuse the UUID; do not submit another send request to check progress. Each status poll increments the API key's authenticated **Request** metric, but does not increment its **Message** or **Sent** counts.

```js
const terminal = new Set(['sent', 'failed']);

async function waitForMessage(messageId) {
  while (true) {
    const response = await fetch(
      `${process.env.SMS_GATEWAY_URL}/api/v1/sms/${messageId}`,
      { headers: { 'X-API-Key': process.env.SMS_GATEWAY_KEY } }
    );
    if (!response.ok) throw new Error(`Status check failed: ${response.status}`);

    const message = await response.json();
    if (message.terminal || terminal.has(message.status)) return message;
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}
```

`sent` means Android accepted the SMS send request. Carrier delivery receipts are not required for status tracking and may not be available on every phone or network.
