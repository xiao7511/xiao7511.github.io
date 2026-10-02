# Android App Links preparation

Status: **NATIVE CLIENT CONFIGURED / DOMAIN VERIFICATION PENDING**.

The Android activity declares verified HTTPS App Links for only `www.nobistudio.com` and the application’s existing logical routes:

- `/anime/<uuid>`
- `/manga/<uuid>`
- `/community/<positive integer>`

The Android path prefixes are dispatch filters, not full identifier validation. The existing Mobile JavaScript deep-link mapper remains authoritative and rejects malformed IDs, unsupported paths, HTTP, and untrusted hosts.

## Production association requirement

After the final Play signing identity is established, publish an extensionless JSON response at:

`https://www.nobistudio.com/.well-known/assetlinks.json`

The statement must use package name `com.nobistudio.app` and the **actual Android App Signing certificate SHA-256 fingerprint** shown by Google Play App Signing. Do not substitute a guessed value or assume the upload key is the installed app signing certificate. A debug association, if used for a separate test domain, must use that build’s actual debug certificate and must not replace the production association.

Generate the file from the repository root only after the real fingerprint is available:

```powershell
$env:ANDROID_SHA256_CERT_FINGERPRINT = '<actual colon-separated SHA-256 fingerprint>'
node scripts/generate-assetlinks.mjs
```

The generator validates the fingerprint format and writes `public/.well-known/assetlinks.json`; this command does not deploy it. Do not commit a placeholder file.

Serve the association directly over valid HTTPS as `application/json`, without redirects. Then verify Android domain association on an installed signed build. `android:autoVerify="true"` only requests verification; it does not prove that the website association is deployed or valid.
