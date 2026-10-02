# Phase 4.7 media rollout

1. Apply `migrations/202610020001_cinematic_media.sql` through the normal reviewed database release process.
2. Run `verify_cinematic_media.sql` read-only and confirm the existing content-management RLS and storage policies remain intact.
3. Deploy Web and Mobile clients. Existing rows without `video_url` remain poster-only.
4. In the existing Banner editor, enter a public HTTPS `.mp4` or `.webm` URL. Host videos in the existing approved external media/storage setup; do not add video binaries to Git.

The migration is required to save video addresses. It has not been executed against production by this change.
