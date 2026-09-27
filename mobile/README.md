# NOBI Mobile

Phase 1 is an independent Vue 3, TypeScript and Capacitor app. The existing Web site remains in `../public/` and uses its existing deployment pipeline.

## Run

Requires Node.js 22+.

```sh
cd mobile
npm ci
npm run dev
npm run typecheck
npm run lint
npm run build
npm run cap:sync:android
```

Open `android/` in a compatible Android Studio installation. The generated `ios/App/App.xcodeproj` must be built and signed on macOS with Xcode; after changing the Web app, run `npm run cap:sync` on macOS before building iOS.

Copy `.env.example` to `.env` for **public** Supabase URL/key and optional API origin. The app can also fetch public Supabase config from Worker `/`, matching the Web site's current contract. Never put secret or service-role credentials in `VITE_` values. The Worker must allow Capacitor's native origins and the selected development origin before live content/auth can work on device.

Phase 2 connects the verified Worker content endpoints and existing Supabase Auth, `profiles`, `posts`, `post_likes`, and `toggle_post_like` RPC. It includes login/registration, session restore/refresh, content details, community feed/detail/replies, atomic likes, and profile state. Favorites and manga chapter reading remain unavailable because no verified production contract exists. Network failures produce visible error states; no sample records are inserted into the app.

See `API_CONTRACT.md` for proven fields and `PHASE2_CORS.md` for the production CORS verification and server-side security finding.
