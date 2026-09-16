# Security deployment notes

1. Apply `supabase/migrations/202609160001_security_hardening.sql` with the Supabase migration workflow. Verify that only the service role can change `profiles.is_admin`.
2. The API Worker is maintained outside this static-site repository. Configure its exact CORS allowlist with `https://www.nobistudio.com`, and add preview origins only when explicitly required.
3. Bind durable rate-limit storage to the external Worker and retain strict input validation and one uniform JSON error envelope across every API route.
4. Keep `SUPABASE_ANON_KEY` in the Worker environment. It is a public client credential; authorization still depends on RLS and Storage policies. Never expose the service-role key.
5. After the remaining legacy admin inline code is migrated, deploy CSP in report-only mode, review violations, and then enforce it.
