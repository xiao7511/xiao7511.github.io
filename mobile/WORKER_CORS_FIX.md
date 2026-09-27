# External Worker CORS deployment change

Status: **SERVER DEPLOYMENT REQUIRED**. The Worker is external to this repository, so this document does not claim that production has been fixed.

## Current production issue

The Worker reflects arbitrary request origins and returns `Access-Control-Allow-Credentials: true`. A preflight from `https://evil.example` was accepted. This policy must be replaced with an explicit allowlist.

## Production allowlist

```text
https://www.nobistudio.com
https://nobistudio.com
capacitor://localhost
http://localhost
https://localhost
```

Development origins such as `http://localhost:5173` should be enabled only in a non-production environment or an explicit development list.

For an allowed request, return its exact origin and `Vary: Origin`. For every other origin, omit `Access-Control-Allow-Origin` and reject the preflight. Keep only the methods and headers actually used by the app, including `Authorization`, `Content-Type`, `apikey` and required Supabase client headers.

## Credentials recommendation

The verified Worker endpoints use public requests or bearer/header authentication rather than browser cookies. Bearer tokens do not require `Access-Control-Allow-Credentials: true`. Remove that header unless a separately audited endpoint proves that cross-origin cookies are required. If cookie credentials are later introduced, review SameSite, CSRF protection and the exact origin list together.

## Verification

Run OPTIONS and real requests for all five allowed origins. Then verify that `https://evil.example` receives no allow-origin header. Also check that responses include `Vary: Origin` and never combine credentials with a wildcard origin.
