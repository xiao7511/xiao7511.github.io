# NOBI iOS build, device and TestFlight guide

The repository is code-complete for an iOS handoff. Xcode compilation, signing and device installation require macOS.

## Mac setup and local build

1. Install the current Node.js LTS supported by the repository (Node 22 or newer).
2. Install the current stable Xcode from the Mac App Store and launch it once to install components.
3. Clone the repository.
4. Run `git checkout feature/nobi-mobile-app`.
5. Run `cd mobile`.
6. Run `npm ci`.
7. Run `npm run build`.
8. Run `npx cap sync ios`.
9. Run `npx cap open ios`.
10. In Xcode, select the App target and open Signing & Capabilities.
11. Select the authorized Apple Developer Team. Never commit certificate passwords or private signing material.
12. Confirm Bundle Identifier `com.nobistudio.app` and Display Name `NOBI 动漫`.
13. Connect and trust an iPhone, then select it as the run destination.
14. Use Product → Build and resolve any signing or Swift Package error.
15. Use Product → Run and complete the checks in `PRODUCTION_TEST_CHECKLIST.md`.

## Universal Links capability

After the production AASA file described in `IOS_UNIVERSAL_LINKS.md` is deployed, add Associated Domains with `applinks:www.nobistudio.com` and `applinks:nobistudio.com`. This capability needs the real developer team and is intentionally not fabricated on Windows.

## Archive and TestFlight

16. Select “Any iOS Device (arm64)” and use Product → Archive. Validate the archive in Organizer.
17. Distribute through App Store Connect, choose TestFlight, wait for processing, complete export compliance and privacy questions, then add an Internal Testing group.

The intended flow is Development → Xcode device test → Archive → App Store Connect → TestFlight → Internal Testing. Long-lived device signing, TestFlight and App Store distribution require Apple Developer Program membership.

Before archiving, increment the build number, confirm version metadata, provide screenshots, support URL and privacy policy, and resolve every BLOCKED item in `IOS_RELEASE_READINESS.md`.
