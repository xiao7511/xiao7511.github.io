# Phase 4 final Xcode readiness review

## Repository-ready items

- App name `NOBI 动漫`, Bundle ID `com.nobistudio.app`, deployment target iOS 15.0.
- Opaque 1024×1024 icon, dark launch screen, portrait configuration and safe-area UI.
- Native Share, status bar, lifecycle/session resume and client Universal Link mapping.
- In-App privacy/support pages, post reporting, user blocking and account-deletion request route.
- Public Privacy Policy and Support pages ready for static deployment.
- ATS remains strict; no unused permission descriptions are present.
- Capacitor iOS dependencies contain privacy manifests in the installed packages.

## Deployment-dependent items

- Apply and verify the Phase 4 Supabase migration.
- Deploy the account-deletion processor and Worker CORS change.
- Publish Privacy/Support pages and generated AASA.
- Add Associated Domains using the real Apple Team ID.

## Mac/Xcode checks still required

- `npm ci`, mobile build, `npx cap sync ios`, Swift Package resolution and Xcode build.
- Select the real Apple Developer Team and confirm signing/capabilities.
- Inspect the archive privacy report and third-party SDK signatures/manifests.
- Run iPhone tests for auth, report, block, deletion request, Share, keyboard, safe areas and Universal Links.
- Increment and confirm marketing/build versions, capture required screenshots, archive and validate.

Status: **XCODE SOURCE READY**. Signed build, iPhone install and App Store archive remain unverified on Windows.
