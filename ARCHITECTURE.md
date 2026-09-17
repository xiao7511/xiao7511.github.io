# Hosting architecture

This repository uses **GitHub Pages + a separately maintained Cloudflare Worker**.

## Responsibility boundary

- `public/` is the complete static site deployed to GitHub Pages. It contains no server-side functions, secrets, or Worker source.
- `https://www.nobistudio.com` is the single public site origin and canonical origin. The `public/CNAME` file binds that hostname on GitHub Pages.
- `https://api.nobistudio.com` is the single API origin. Its Cloudflare Worker is deployed and configured outside this repository.
- Supabase migrations remain in `supabase/` for database administration and are not included in the Pages artifact.

## Deployment

The Pages workflow validates the static boundary, stages an explicit `dist/` artifact from `public/`, and deploys only `dist/`. The generated directory is deliberately ignored by Git.

The external Worker must allow only the production site origin (and explicitly configured preview/development origins), validate inputs, rate-limit requests, and enforce the policies described in `SECURITY.md`.
