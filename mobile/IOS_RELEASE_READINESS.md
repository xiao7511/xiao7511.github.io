# NOBI iOS release readiness

| Area               | Status  | Evidence / required action                                                                        |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------- |
| App name           | READY   | `NOBI 动漫` in Capacitor and Info.plist                                                           |
| Bundle ID          | READY   | `com.nobistudio.app` in Capacitor and Xcode project                                               |
| Version            | PARTIAL | Xcode marketing version `1.0`, build `1`; confirm release numbering before archive                |
| Deployment target  | READY   | iOS 15.0, matching Capacitor 8 package configuration                                              |
| App icon           | READY   | Opaque 1024×1024 NOBI master; iOS applies the mask                                                |
| Splash             | READY   | Dark NOBI launch asset and matching Capacitor background                                          |
| Orientation        | READY   | Portrait on iPhone; portrait/upside-down on iPad                                                  |
| Permissions        | READY   | No camera, photo, microphone or location usage descriptions because those APIs are unused         |
| ATS                | READY   | Default strict ATS; no arbitrary-load exception; production services use HTTPS                    |
| Universal Links    | PARTIAL | Client mapping and validated generator ready; real Team ID, AASA deployment and capability remain |
| Signing            | BLOCKED | Real Apple Developer Team and signing identity required on macOS                                  |
| Xcode/device build | BLOCKED | Xcode and iPhone testing are unavailable on Windows                                               |
| Screenshots        | BLOCKED | Capture final device screenshots after signed iPhone validation                                   |
| Privacy policy     | PARTIAL | `public/privacy.html` ready; production publication and owner approval remain                     |
| Support URL        | PARTIAL | `public/support.html` ready; production publication remains                                       |
| App privacy        | PARTIAL | Repository inventory complete; App Store Connect answers require human production confirmation    |
| UGC moderation     | PARTIAL | App/report/block/admin code ready; migration and production operations remain                     |
| CORS               | BLOCKED | External Worker allowlist deployment is required                                                  |

## Privacy review input

The app supports account registration/authentication, profile display, community posts/replies and likes. App Store Connect must be reviewed by the product owner against the production Supabase configuration and privacy policy for identifiers, contact information, user content and authentication data. No analytics SDK was found in the mobile package. This is factual implementation input, not a completed Apple Privacy Label.

## User-generated content risk

Phase 4 adds in-app reporting and blocking, an admin moderation queue and an account-deletion request flow. These remain an **APP STORE REVIEW RISK** until the migration, moderation operations and server-side deletion processor are deployed and verified. Do not claim that production moderation or deletion exists before that deployment.
