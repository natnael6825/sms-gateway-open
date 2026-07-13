# SignalDesk

SignalDesk is a single-owner, self-hosted SMS gateway. Its API queues messages and a paired Android phone sends them through its SIM. The repository contains the Express/PostgreSQL backend, React dashboard, and native-enabled Expo Android app.

## Quick start

Requirements: Docker (recommended), or Node.js 20+ and PostgreSQL 14+, plus an Android phone with a SIM.

1. Copy the root `.env.example` to `.env`.
2. Set a strong database password, a random `JWT_SECRET`, your `ADMIN_EMAIL`, and a temporary `ADMIN_PASSWORD` of at least 12 characters.
3. Run `docker compose up --build -d`.
4. Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL` to the backend URL.
5. Run `cd frontend`, `npm install`, and `npm run dev`.
6. Sign in with the owner credentials and replace the temporary password when prompted.
7. Open **Documentation** inside the dashboard for the guided phone, test-message, and API setup.

There is no public signup and no SignalDesk daily quota. The configured owner is created automatically the first time the backend starts. Later restarts do not reset the password.

## Android app

The Android app accepts the backend URL during pairing and saves it locally, so one APK works with any deployment. A prebuilt APK can be placed in `releases/`. To compile it yourself:

[Download the current standalone APK from Expo](https://expo.dev/accounts/natnaelfikre/projects/sms-gateway/builds/47e2635c-ba6b-4f92-ab72-aeb35ddab681). Allow Google Play Protect to scan it during installation.

```bash
cd mobile
npm install
npx expo run:android
```

Or build an installable APK with `eas build --platform android --profile preview`. Expo Go is not sufficient because silent SMS sending uses native Kotlin modules.

See [Android and ADB setup](docs/ANDROID.md) for USB installation, diagnostics, and Android outgoing-check settings.

If a sideloaded APK shows **App was denied access** for SMS, Android has blocked a restricted permission. Follow the [restricted SMS permission instructions](docs/ANDROID.md#fix-app-was-denied-access-for-sms-permission) to enable it from App info or grant it on an owner-controlled phone over ADB.

## Deploying

The backend requires `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. `PORT` and `CORS_ORIGIN` are optional but recommended. The Docker setup constructs `DATABASE_URL` for you.

The dashboard’s `VITE_API_URL` is embedded at build time. Set it before `npm run build`, publish `frontend/dist`, configure SPA fallback to `index.html`, and put its origin in backend `CORS_ORIGIN`.

Detailed guides:

- [Deployment](docs/DEPLOYMENT.md)
- [Android, APK, EAS, and ADB](docs/ANDROID.md)
- [HTTP API integration](docs/API.md)
- [Production security](docs/SECURITY.md)

## Send from another project

Generate an API key under **API access**, then call:

```bash
curl -X POST https://sms.example.com/api/v1/sms/send \
  -H "X-API-Key: sms_your_key" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+251900000000","message_text":"Your order is ready."}'
```

An HTTP 201 response returns a public message UUID and means queued, not sent. Check the final result with the same API key:

```bash
curl https://sms.example.com/api/v1/sms/MESSAGE_UUID \
  -H "X-API-Key: sms_your_key"
```

Poll every 2–5 seconds until the response is `sent` or `failed`. See the [HTTP API guide](docs/API.md) for lifecycle fields and complete examples.

## License

MIT. Operators are responsible for recipient consent, carrier terms, opt-out handling, and applicable law.
