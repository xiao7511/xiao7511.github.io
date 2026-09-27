# Phase 4.2 Reply Image Recovery and Rollback

## Transaction failure

`202609270002_community_reply_images.sql` runs in one PostgreSQL transaction. A failed precondition,
constraint validation, grant, bucket operation, or policy operation rolls the transaction back. Investigate the
exception, rerun the read-only preflight, and do not continue with the application rollout while it reports
`BLOCKED / REVIEW REQUIRED`.

## Migration succeeded but the application was not published

Keep the database migration in place. `image_path` is nullable, existing rows remain valid, and older clients do
not need to write the new column. The dedicated bucket and policies can remain unused until the application is
released.

## Application rollback after release

Roll back the application first and leave the database objects in place. The nullable column, bucket, and policies
are backward compatible with clients that do not use reply images.

Do not directly drop `public.posts.image_path`, the `community` bucket, or its objects after image paths have been
written. A destructive database rollback requires all of the following manual steps:

1. Export and back up every non-null `posts.image_path` value and the corresponding Storage object.
2. Confirm whether each object is referenced by another environment or application version.
3. Migrate or clear database references in a reviewed maintenance operation.
4. Remove only confirmed orphan objects, with a recoverable Storage backup.
5. Drop policies, the constraint, the column, or the bucket only after references and objects are both accounted for.

## Remaining storage-abuse risk

An authenticated user can upload allowed images into their own directory without creating a matching reply. The
clients remove an upload when reply insertion fails, but abandoned sessions and direct API use can still leave
orphans. A future maintenance phase should add per-user upload quotas, rate limiting, and a scheduled orphan scan
that deletes only objects older than a safety window and absent from every `posts.image_path` reference.
