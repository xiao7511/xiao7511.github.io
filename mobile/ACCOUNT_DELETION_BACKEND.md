# Account deletion backend contract

The App calls authenticated RPC `request_account_deletion()`. That RPC creates or reopens a row in `account_deletion_requests`; it does **not** possess authority to delete `auth.users`. Production deletion therefore requires a trusted external worker or scheduled job.

## Required processor

1. Run only in a server environment. Store `SUPABASE_SERVICE_ROLE_KEY` as a server secret and never return or bundle it to Web/iOS clients.
2. Read requests with status `requested`, claim one idempotently by changing it to `processing`, and record retry-safe operational logs.
3. Inspect the deployed foreign keys from `supabase/phase4_preflight.sql` before choosing delete versus anonymize behavior for posts and replies.
4. Delete or anonymize profile and community data according to the published privacy policy and approved retention schedule. Remove likes, blocks and active sessions.
5. Delete the Supabase Auth user with the server-side Admin API.
6. Mark the request `completed` with a timestamp. Because the request table intentionally has no auth.users foreign key, the completion audit can survive user deletion.
7. Retry partial failures safely and alert an operator. Never mark completion before Auth deletion succeeds.

The processor must authenticate its scheduler/operator, rate-limit manual endpoints, avoid accepting a caller-supplied user ID without authorization, and redact tokens from logs. Phase 4 does not deploy this external service because the Worker source and production secrets are outside this repository.
