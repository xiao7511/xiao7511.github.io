# NOBI Phase 4 production deployment runbook

Every production mutation below requires an authorized operator. Repository tests do not deploy external systems.

## 1. Database staging and production

1. Take a database backup and record the current migration version.
2. Run `supabase/phase4_preflight.sql` read-only; review posts/profile columns, RLS, `is_admin()` ACLs and foreign-key delete behavior.
3. Apply `supabase/migrations/202609270001_phase4_trust_safety.sql` to staging as the database owner.
4. Run `supabase/verify_phase4_trust_safety.sql` and verify all four tables use RLS, browser roles have read-only table grants, and only authenticated users can execute user RPCs.
5. Test two normal accounts and one admin: report, duplicate report update, block/unblock RPC, hidden-post visibility, moderator actions and deletion request.
6. Repeat the approved migration and verification in production. Keep the migration transaction log and rollback plan.

## 2. External Worker CORS

Integrate `scripts/worker-cors.mjs` into the external Worker. Deploy staging, verify five allowed origins, ensure `https://evil.example` receives HTTP 403/no allow-origin, then deploy production. The API uses bearer/header authentication, so the helper intentionally omits `Access-Control-Allow-Credentials`.

## 3. Account deletion processor

Implement and deploy the server-only processor specified in `ACCOUNT_DELETION_BACKEND.md`. Test idempotency, Auth deletion, data cleanup/anonymization, completion audit and operator alerts before advertising account deletion as production-ready.

## 4. Static policy and moderation pages

Deploy the normal static artifact. Verify:

- `https://www.nobistudio.com/privacy.html`
- `https://www.nobistudio.com/support.html`
- `https://www.nobistudio.com/moderation.html` with a normal and admin account

The moderation page must remain protected by database admin checks and RLS; `robots=noindex` is not an authorization control.

## 5. AASA and Xcode

Obtain the real Apple Team ID, run `APPLE_TEAM_ID=<TEAM_ID> node scripts/generate-aasa.mjs`, review and deploy the generated extensionless file. Confirm HTTPS content type and no redirect. Add Associated Domains in Xcode, build a signed device app, and test all three route families from Notes/Messages.
