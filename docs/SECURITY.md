# Production security checklist

- Use HTTPS for the dashboard and API.
- Generate a long, random `JWT_SECRET` value.
- Replace the temporary owner password immediately after first login.
- Restrict `CORS_ORIGIN` to deployed dashboard origins.
- Keep PostgreSQL private and backed up.
- Never commit `.env`, API keys, device tokens, or production database exports.
- Remove lost phones from **Devices**; active-device validation rejects their stored token.
- Resetting a pairing key revokes all existing paired devices.
- Rotate an exposed API key from **API access**.
- Apply operating-system, Node.js, npm, and PostgreSQL security updates.
- Send only consent-based traffic and provide legally required opt-out handling in the integrating application.

Report vulnerabilities privately to the repository maintainer rather than opening a public issue containing exploit details or secrets.
