# NOBI iOS Universal Links preparation

Status: **CLIENT READY / SERVER DEPLOYMENT REQUIRED**.

The mobile client maps these HTTPS links to Vue routes through Capacitor `appUrlOpen` and cold-start `getLaunchUrl()` handling:

- `https://www.nobistudio.com/anime/<uuid>` → `/anime/<uuid>`
- `https://www.nobistudio.com/manga/<uuid>` → `/manga/<uuid>`
- `https://www.nobistudio.com/community/<positive integer>` → `/community/<id>`

Only `https://nobistudio.com` and `https://www.nobistudio.com` are accepted. Unknown hosts, HTTP URLs, malformed identifiers and unsupported paths are ignored.

## Server requirement

Publish an unsigned JSON response at:

`https://www.nobistudio.com/.well-known/apple-app-site-association`

It must be served directly over HTTPS with `application/json`, without a redirect. A future deployment should use this shape after the real Apple Team ID is known:

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["<APPLE_TEAM_ID>.com.nobistudio.app"],
        "components": [{ "/": "/anime/*" }, { "/": "/manga/*" }, { "/": "/community/*" }]
      }
    ]
  }
}
```

`APPLE_TEAM_ID` is intentionally unresolved. Do not publish the placeholder.

After obtaining the real Team ID, generate the deployable file from the repository root:

```sh
APPLE_TEAM_ID=A1B2C3D4E5 node scripts/generate-aasa.mjs
```

The generator rejects missing or malformed Team IDs and writes `public/.well-known/apple-app-site-association`. Review the generated app ID before committing and deploying it. No placeholder AASA file is published by Phase 4.

## Xcode requirement

On the signing Mac, add the Associated Domains capability to the App target and add:

```text
applinks:www.nobistudio.com
applinks:nobistudio.com
```

Test with an installed, signed build by opening a link from Notes or Messages. Safari address-bar navigation alone is not a complete Universal Links test.

## Swipe-back note

The Vue app uses router history and explicit back buttons and does not install a global touch handler. WKWebView edge-swipe behavior is not verified on Windows. If product testing requires native interactive pop gestures, implement and review that behavior in the iOS navigation controller on macOS instead of intercepting WebView touches globally.
