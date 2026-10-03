-- Phase 4.7: optional public cinematic media on canonical content rows.
-- Apply before editors save video URLs. Existing rows remain poster-only.
alter table public.content_management
  add column if not exists video_url text;

comment on column public.content_management.video_url is
  'Optional public HTTPS MP4/WebM preview URL. Never store private or signed credentials.';
