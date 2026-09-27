# NOBI Mobile Phase 1 architecture audit

## Current production boundary

`public/` is a static HTML, CSS and JavaScript site. `scripts/build-static.sh` copies it to ignored `dist/`; `.github/workflows/deploy.yml` runs lint, tests, validation, build and Playwright smoke checks before deploying that artifact to GitHub Pages. `public/CNAME` names the public site. `wrangler.jsonc` describes static assets, while `ARCHITECTURE.md` says the `api.nobistudio.com` Cloudflare Worker is maintained outside this repository. Its source, deployed CORS rules and production environment are therefore not verifiable here.

Web UI → Worker `/api/recommend`, `/api/manga`, `/api/detail` and Supabase JS → Supabase Auth/PostgREST/Storage → database. The Web client obtains `SUPABASE_URL` and the public `ANON_KEY` from Worker `/` at runtime. Existing `public/supabaseClient.js` is empty; the actual initializer is `public/assets/js/src/api/supabase.js`. Web home/community also query Supabase directly.

## Reuse boundary

Reuse the API contract, public Supabase Auth/database, content fields (`category`, `slot_index`, `title`, `subtitle`, `cover_url`, `theme_tags`, `year`), image target key semantics, and reviewed RLS/RPC design. `posts` and `post_likes` have migrations; `image_likes` uses RPCs. The `profiles` table supplies avatar/nickname. No favorites table or migration was found. No manga chapter contract was found. Their production state still needs a database/Worker check.

Do not import Web page modules into Mobile. `public/assets/js/main.js` couples auth, DOM, `window` globals, `localStorage`, community and content rendering. Some Web modules use inline handlers and `innerHTML` for constant SVG. Web CSS targets desktop markup. Its `site_config` and analytics code rely on page-specific semantics.

## Risks and decisions

- The mobile `capacitor://localhost` / `http://localhost` origin must be allowed by the external Worker if the App fetches Worker endpoints. Production CORS cannot be confirmed from this repository. Supabase direct API calls also require valid public key and RLS.
- The repository has SQL for RLS, users privilege hardening, post likes and image likes. Applied production migration state is unknown; no database changes are made in Phase 1.
- Stored Supabase sessions on device need expiry/refresh validation before fetching the user or protected data. Mobile disables URL session detection until a reviewed deep-link flow exists.
- `VITE_` variables are bundled into the installable app. Only public URL and public/anon key belong there. Secret/service-role keys must stay server-side.
- Mobile image URLs must be HTTPS and treated as untrusted. The Web image helper assumes a website origin, so it cannot be imported unchanged.
- The Worker API, CORS/CSP, live API response schema, image hosts and auth redirects cannot be fully verified offline. The Phase 1 shell must show explicit error/empty states rather than substitute fixture data.
- Windows can generate/sync Android sources but cannot verify iOS compilation or signing.

## Mobile design

Mobile UI → Vue Router → Pinia → Services → Worker API / Supabase → database. Native plugins sit beside the UI for status bar, splash, share, back button and lifecycle. The mobile package and native projects build independently of the Web deployment.
