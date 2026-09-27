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
npm run cap:sync:ios
npm run cap:sync:android
```

Open `android/` in a compatible Android Studio installation. The generated `ios/App/App.xcodeproj` must be built and signed on macOS with Xcode; after changing the Web app, run `npm run cap:sync` on macOS before building iOS.

Copy `.env.example` to `.env` for **public** Supabase URL/key and optional API origin. The app can also fetch public Supabase config from Worker `/`, matching the Web site's current contract. Never put secret or service-role credentials in `VITE_` values. The Worker must allow Capacitor's native origins and the selected development origin before live content/auth can work on device.

Phase 2 connects the verified Worker content endpoints and existing Supabase Auth, `profiles`, `posts`, `post_likes`, and `toggle_post_like` RPC. It includes login/registration, session restore/refresh, content details, community feed/detail/replies, atomic likes, and profile state. Favorites and manga chapter reading remain unavailable because no verified production contract exists. Network failures produce visible error states; no sample records are inserted into the app.

See `API_CONTRACT.md` for proven fields and `PHASE2_CORS.md` for the production CORS verification and server-side security finding.

Phase 3 prepares the iPhone UI, NOBI icon/splash assets, native share fallback, lifecycle handling and Universal Link route mapping. Use `IOS_BUILD.md` for the macOS/Xcode handoff, `IOS_RELEASE_READINESS.md` for App Store blockers, and `PRODUCTION_TEST_CHECKLIST.md` for signed-device validation. Production Universal Links and the Worker CORS correction still require server deployment.

Supabase sessions currently use the reviewed Web Storage adapter in WKWebView. Keep the adapter boundary when moving to Capacitor Preferences or a Keychain-backed secure-storage implementation. Such a migration must include device persistence, refresh, logout cleanup and upgrade tests; Phase 3 does not add an unverified native storage plugin.

Phase 4 repository work adds Trust & Safety schema/RPC preparation, in-app reporting and blocking, an account-deletion request, public Privacy/Support pages, a moderator queue, CORS/AASA helpers and App Store privacy documentation. These capabilities require the deployment sequence in `PHASE4_DEPLOYMENT.md`; the repository does not imply that the external Worker, production database, deletion processor or Apple configuration has been deployed.
