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

The first release scaffold shows real `/api/recommend` and `/api/manga` data when available. Community feed, login/register actions, detail pages, favorites and chapter reading remain for later phases after their production contracts are verified. Network failures produce visible error states; no sample records are inserted into the app.
