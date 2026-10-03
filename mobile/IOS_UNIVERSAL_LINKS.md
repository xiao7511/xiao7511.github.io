# NOBI iOS Universal Links preparation

Status: **CLIENT CONFIGURED / SERVER DEPLOYMENT REQUIRED**.

The mobile client maps these HTTPS URLs through Capacitor `appUrlOpen` and cold-start `getLaunchUrl()` handling, then uses the existing strict Vue route mapper:

- `https://www.nobistudio.com/anime/<uuid>` → `/anime/<uuid>`
- `https://www.nobistudio.com/manga/<uuid>` → `/manga/<uuid>`
- `https://www.nobistudio.com/community/<positive integer>` → `/community/<id>`

Only the NOBI root and `www` HTTPS hosts are accepted by the JavaScript mapper. Unknown/lookalike hosts, HTTP links, malformed IDs and unsupported paths are ignored.

## Native entitlement

The App target references `App/App.entitlements` for Debug and Release. It contains only `Associated Domains` with `applinks:www.nobistudio.com`. The Bundle ID is `com.nobistudio.app`.

## AASA server requirement

Publish an extensionless JSON response at:

`https://www.nobistudio.com/.well-known/apple-app-site-association`

Serve it directly over valid HTTPS with `Content-Type: application/json` and no redirects. The generator emits the real Team ID plus `com.nobistudio.app`, and only these path patterns:

- `/anime/????????-????-????-????-????????????`
- `/manga/????????-????-????-????-????????????`
- `/community/?*`

The app performs final UUID and positive-integer validation. `?` matches one path character and `*` matches a path substring.

`APPLE_TEAM_ID` is intentionally unresolved. Do not use a placeholder or publish a generated file until the real 10-character Apple Team ID is known. From the repository root, generate it with:

```sh
APPLE_TEAM_ID=<real-apple-team-id> node scripts/generate-aasa.mjs
```

The output defaults to `public/.well-known/apple-app-site-association`; generation does not deploy it.

## Mac verification

On the signing Mac, confirm the App target retains `applinks:www.nobistudio.com`, select the real Development Team, and verify the served AASA URL, MIME type, TLS and absence of redirects. Test a signed, installed build by opening each supported link from Notes or Messages; Safari address-bar navigation alone is not a complete Universal Links test.

## Swipe-back note

The Vue app uses router history and explicit back buttons and does not install a global touch handler. WKWebView edge-swipe behavior is not verified on Windows. If product testing requires native interactive pop gestures, implement and review that behavior in the iOS navigation controller on macOS instead of intercepting WebView touches globally.
