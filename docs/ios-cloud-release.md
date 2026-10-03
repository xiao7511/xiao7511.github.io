# NOBI iOS cloud release from Windows

## 1. Prerequisites

The reviewed native project is committed under `mobile/ios/App`. Keep it in Git;
do not regenerate it in CI. Web assets and native generated config are ignored
and recreated by `cap sync ios`. Bundle ID: `com.nobistudio.app`; display name:
`NOBI 动漫`; minimum iOS: 15.0. The actual target and shared scheme are `App`.
This is a Swift Package Manager project, not a CocoaPods project: there is no
Podfile and no separate App.xcworkspace. Build `App.xcodeproj`.

Workflow `nobi-ios-testflight` pins Node 24.19.0 (compatible with the locked Vite
and Capacitor 8 requirements) and Xcode 26.2 on mac_mini_m2. No local Mac is needed.
Review toolchain pins deliberately when Apple changes submission requirements.
The first cloud archive remains unverified until Codemagic executes it.

## 2. Apple Developer account

Enroll in/verify an active Apple Developer Program membership, accept current
agreements, and ensure the operator has access to Certificates, Identifiers &
Profiles and App Store Connect. Do not put Apple passwords in the repository.

## 3. App Store Connect app creation

Create or verify the iOS app record with the existing Bundle ID. Choose the real
name, SKU and primary language; do not invent identifiers in CI. Record the
numeric Apple ID privately in your release records. Complete beta review contact
information and any encryption/export-compliance questions before submission.

## 4. Bundle ID setup

Register/verify the explicit App ID `com.nobistudio.app` under the actual Apple
Team. Enable Associated Domains because the app already declares
`applinks:www.nobistudio.com`. A matching distribution profile must include that
capability. Preserve the native entitlement. Universal Links additionally need
the real Team ID in the website AASA: see `mobile/IOS_UNIVERSAL_LINKS.md`.
This workflow does not deploy association files.

## 5. App Store Connect API key

In App Store Connect go to Users and Access → Integrations → App Store Connect
API. Create a dedicated team API key with App Manager access; ensure the account
also has the permissions needed to manage signing identities. Download the `.p8`
once and store it securely outside Git. Issuer ID, Key ID and private key belong
in Codemagic's integration UI, not `.env`, YAML or source code.

## 6. Codemagic account

Create/select a Codemagic team with macOS build capacity. Restrict who can change
release YAML or run workflows using signing identities. Do not run untrusted PR
code with this integration. Initial trigger policy is manual only.

## 7. GitHub repository connection

Connect `xiao7511/xiao7511.github.io` and grant the needed repository access.
After this feature branch is reviewed and pushed, select
`feature/nobi-phase46-ios-cloud-release` and scan root `codemagic.yaml`.
Choose workflow `nobi-ios-testflight`. Later, use a reviewed release branch or
version tag; normal development commits must not automatically publish.

## 8. Codemagic Apple integration

Team settings → Team integrations → Developer Portal → Manage keys → Add key.
Name the integration exactly `nobi-apple` (the name referenced in YAML), then
enter Issuer ID, Key ID and upload the API private key securely.

## 9. Environment variables

Create environment group `nobi_ios_public` and attach it to this application.

| Name | Class | Setup |
| --- | --- | --- |
| `VITE_API_BASE_URL` | PUBLIC | `https://api.nobistudio.com`; default is already in code |
| `VITE_WEB_BASE_URL` | PUBLIC | `https://www.nobistudio.com`; default is already in code |
| `VITE_SUPABASE_URL` | PUBLIC | Optional; use with the next value as a pair |
| `VITE_SUPABASE_ANON_KEY` | PUBLIC | Optional anon JWT/publishable key only |
| `IOS_BUILD_NUMBER_OFFSET` | BUILD_ONLY | Optional nonnegative integer; see versioning below |
| `IOS_MARKETING_VERSION` | BUILD_ONLY | YAML sets `1.0.0`; change deliberately for future releases |
| `PROJECT_BUILD_NUMBER` | BUILD_ONLY | Supplied automatically by Codemagic |
| `nobi-apple` integration credentials | SECRET | Integration UI only; no custom secret variables needed |

If BOTH Supabase variables are absent, the existing HTTPS Worker public-config
endpoint supplies them. CI does not access production data to validate that
fallback. Every `VITE_` value is embedded in the IPA and is public regardless of
whether the Codemagic UI marks it secure. Never add service-role/server keys.
Preflight rejects partial overrides, privileged keys, unsafe URL schemes and
local endpoints without printing their values. See `mobile/.env.example`.

## 10. Code signing and build numbering

Team settings → codemagic.yaml settings → Code signing identities: generate or
securely upload an Apple Distribution certificate. Fetch/create an App Store
provisioning profile for `com.nobistudio.app` that matches that certificate and
Associated Domains. Codemagic's `ios_signing` selects matching stored identities;
it does not create missing identities merely because YAML exists.
`xcode-project use-profiles` applies the actual Team/profile at build time.
No fake Team ID or local signing assets are needed.

Native source keeps marketing version `1.0` and build `1`; CI sets
`MARKETING_VERSION=1.0.0` via agvtool and `CURRENT_PROJECT_VERSION` to
`PROJECT_BUILD_NUMBER + IOS_BUILD_NUMBER_OFFSET`. The counter spans this
Codemagic application, including failed runs. Before the first upload, choose an
offset that makes the number greater than any previously uploaded build.
Preserve the offset; if the Codemagic application is recreated, establish a new
offset. Run release builds serially and never upload an older completed build
after a newer one. Other publishers must coordinate their build-number ranges.
This avoids hardcoding every upload to build 1 without needing another Apple ID
in source. No build-version edits are committed by CI.

## 11. Running the first build

Start a manual build of the reviewed branch/workflow. Stages are environment
preflight → locked npm dependencies → Mobile tests/lint → Vite production build
and typecheck → Capacitor sync → SPM resolution/scheme inspection → distribution
profiles → versioning → Release archive/export → App Store Connect publishing.
Each stage fails on error. No local Vite server is packaged. Do not run `pod
install`: this native project uses SPM. Cloud Xcode is the first authoritative
native compilation check.

## 12. Finding the IPA

Open Codemagic build → Artifacts: signed IPA under `build/ios/ipa`, archive under
`build/ios/xcarchive`, and Xcode logs. These are CI artifacts, not Git files.
Verify Bundle ID, build/version, signing and entitlements on the produced archive.

## 13. TestFlight processing

Publishing uses the `nobi-apple` integration. IPA upload and Apple's processing
are separate from the archive result. `submit_to_testflight: true` requests beta
review during Codemagic post-processing. `submit_to_app_store: false` prevents
automatic public App Store submission. No beta-group names are guessed; assign
the processed build to your real groups in App Store Connect. A green archive
alone is not proof of successful processing or upload.

## 14. Installing on iPhone

Install TestFlight from the App Store, accept the actual testing invitation, and
install the processed NOBI build. Verify launch, login, persisted session/logout,
Home/Library/Detail, Community/reply images, avatar upload, Admin denial/allow,
account deletion, external links, keyboard/safe areas and cold/deep links.
Do not perform destructive account tests with an irreplaceable production user.

## 15. Internal and external testers

Assign eligible App Store Connect users to internal testing first. External
testing requires Apple's beta review and accurate beta metadata. Manage tester
groups/invitations in App Store Connect; credentials and personal tester data
must stay outside Git. Do not enable public App Store release in this workflow.

## 16. Common build failures

| Classification | Check/fix |
| --- | --- |
| DEPENDENCY_FAILURE | npm ci/lockfile or registry; keep lockfile and supported Node pin |
| WEB_BUILD_FAILURE | test/lint/vue-tsc/Vite failure; repair source without disabling checks |
| CAPACITOR_SYNC_FAILURE | installed versions, webDir/dist and SPM plugin paths |
| PODS_FAILURE | unexpected for this SPM project; check drift before adding Pods |
| XCODE_COMPILE_FAILURE | exact Xcode log, shared App scheme, SDK/plugin compatibility |
| CODE_SIGNING_FAILURE | real Team, certificate private key, matching App Store profile/capabilities |
| ARCHIVE_FAILURE | Release archive/export log and export-options/signing consistency |
| APP_STORE_UPLOAD_FAILURE | app record, API access, agreements, duplicate build/version |
| TESTFLIGHT_PROCESSING_FAILURE | App Store Connect processing/beta review/export compliance |

Keep the exact relevant non-secret error in release notes. Do not print
environment dumps, credentials or private key contents. Do not weaken ATS or
disable tests to hide failures.

## 17. App Store submission checklist

Use [ios-app-store-checklist.md](ios-app-store-checklist.md). App Review,
content rights, privacy disclosures, screenshots and device acceptance are
separate gates from CI preparation. Windows checks cannot establish archive,
signing, TestFlight upload or iPhone behavior.

## Runtime/privacy audit notes

Auth uses existing persistent local WebView storage and automatic session
refresh; verify on iPhone restart/resume. Existing account deletion has an
in-app entry and authenticated `request_account_deletion()` boundary:
ACCOUNT_DELETION_READY for initiating a request by source audit. Actual server
completion, retention and timing require separate verification; a successful
request does not prove deletion has completed. Profile/Community/Admin uploads use
File objects and HTML file inputs, not desktop paths; test JPEG/PNG/WebP and
failure cleanup on iPhone. No native camera/location/etc API is introduced, so
no new permission descriptions are added. Capacitor dependencies provide
privacy manifests; inspect the final archive's aggregated privacy report and
Required Reason API declarations. No speculative app manifest is added.
Backend/config/Storage use HTTPS. The supported HTTP Weibo link is external
navigation, not an in-WebView HTTP API; verify iOS external-open behavior.
No broad ATS exception, auth redesign, database or Storage changes are needed.

## Official references

- https://docs.codemagic.io/yaml-quick-start/building-a-native-ios-app/
- https://docs.codemagic.io/yaml-code-signing/signing-ios/
- https://docs.codemagic.io/yaml-publishing/app-store-connect/
- https://docs.codemagic.io/knowledge-codemagic/build-versioning/
