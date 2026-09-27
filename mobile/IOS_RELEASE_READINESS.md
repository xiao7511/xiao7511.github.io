# NOBI iOS release readiness

| Area               | Status  | Evidence / required action                                                                      |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------- |
| App name           | READY   | `NOBI 动漫` in Capacitor and Info.plist                                                         |
| Bundle ID          | READY   | `com.nobistudio.app` in Capacitor and Xcode project                                             |
| Version            | PARTIAL | Xcode marketing version `1.0`, build `1`; confirm release numbering before archive              |
| Deployment target  | READY   | iOS 15.0, matching Capacitor 8 package configuration                                            |
| App icon           | READY   | Opaque 1024×1024 NOBI master; iOS applies the mask                                              |
| Splash             | READY   | Dark NOBI launch asset and matching Capacitor background                                        |
| Orientation        | READY   | Portrait on iPhone; portrait/upside-down on iPad                                                |
| Permissions        | READY   | No camera, photo, microphone or location usage descriptions because those APIs are unused       |
| ATS                | READY   | Default strict ATS; no arbitrary-load exception; production services use HTTPS                  |
| Universal Links    | PARTIAL | Client mapping ready; AASA deployment and Associated Domains capability require server/Mac work |
| Signing            | BLOCKED | Real Apple Developer Team and signing identity required on macOS                                |
| Xcode/device build | BLOCKED | Xcode and iPhone testing are unavailable on Windows                                             |
| Screenshots        | BLOCKED | Capture final device screenshots after signed iPhone validation                                 |
| Privacy policy     | BLOCKED | Public privacy-policy URL must be confirmed by the product owner                                |
| Support URL        | BLOCKED | Public support URL must be confirmed by the product owner                                       |
| App privacy        | PARTIAL | App Store Connect declarations require a human review of account, profile and community data    |
| UGC moderation     | BLOCKED | Community has no proven in-app report, block or account-deletion workflow                       |
| CORS               | BLOCKED | External Worker allowlist deployment is required                                                |

## Privacy review input

The app supports account registration/authentication, profile display, community posts/replies and likes. App Store Connect must be reviewed by the product owner against the production Supabase configuration and privacy policy for identifiers, contact information, user content and authentication data. No analytics SDK was found in the mobile package. This is factual implementation input, not a completed Apple Privacy Label.

## User-generated content risk

The existing community can publish posts and replies, but no proven in-app reporting, user blocking, moderation queue or account-deletion flow exists. This is an **APP STORE REVIEW RISK** and should be addressed before external TestFlight or App Review. Do not claim that server-side moderation exists without evidence.
