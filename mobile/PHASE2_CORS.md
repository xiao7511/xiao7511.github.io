# Phase 2 CORS verification

Production preflight checks on 2026-09-27 returned `200` and echoed each of these origins:

- `capacitor://localhost` (iOS default)
- `http://localhost` (Android default)
- `https://localhost`

The required `Authorization`, `Content-Type`, `apikey` and Supabase client headers and all used methods were allowed. Mobile connectivity is therefore verified for these origins.

The Worker also echoed `https://evil.example` and returned `Access-Control-Allow-Credentials: true`. This is an overly permissive reflection policy. Server security status is **FAIL** until the external Worker restricts origins.

Recommended exact allowlist: `https://www.nobistudio.com`, `capacitor://localhost`, `http://localhost`, `https://localhost`, plus explicit development origins such as `http://localhost:5173`. Return `Vary: Origin`; emit `Access-Control-Allow-Origin` only for an allowed origin; reject other preflights. Keep the current required header/method list. If the API does not use cookies, remove `Access-Control-Allow-Credentials`; bearer tokens still work through the `Authorization` header. Do not use `mode: no-cors`.

Reverify with an `OPTIONS` request for every allowed origin and one disallowed origin. The disallowed request must not receive an allow-origin header.
