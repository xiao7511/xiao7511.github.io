# NOBI App Store / TestFlight checklist

This is a release gate, not a declaration that NOBI already complies. Record
real values/evidence in App Store Connect or secure release records, not secrets
in this file. Never commit review-account passwords.

- [ ] Active Apple Developer membership and accepted agreements.
- [ ] Actual Team and explicit Bundle ID `com.nobistudio.app` registered.
- [ ] App Store Connect app record, app name, unique SKU and primary language.
- [ ] Category and age rating reflect actual anime/manga and Community content.
- [ ] Privacy Policy URL and Support URL are public, accurate and working.
- [ ] App Privacy questionnaire covers actual collected data, Supabase/Worker,
      authentication, uploads and third-party dependency behavior.
- [ ] Archive privacy report and Required Reason APIs reviewed against the
      actual Capacitor/plugin manifests; no invented declarations.
- [ ] iPhone/iPad screenshots for every device family offered by the build.
- [ ] NOBI 1024px app icon, description, subtitle, keywords and copyright.
- [ ] **CONTENT RIGHTS / COPYRIGHT:** operator has verified rights to distribute
      every anime/manga image, text, logo and other bundled/remote content.
      No ownership or licensing claim is inferred from this repository.
- [ ] Review contact information, notes and clear instructions for gated flows.
- [ ] Working review/demo account supplied privately in App Store Connect if
      login is needed; no credentials stored in Git.
- [ ] Export-compliance/encryption answers reflect the actual app.
- [ ] In-app account-deletion entry works; successful deletion clears session;
      failure is safe. Existing source flow is not a substitute for device testing.
- [ ] Community UGC safeguards reviewed: reporting/admin review exist; verify
      objectionable-content handling, contact process and user blocking support
      (not assumed present). Document any missing review requirement separately.
- [ ] Associated Domains profile and production AASA verified with actual Team.
- [ ] Signed Release IPA passes archive/export validation in Codemagic macOS.
- [ ] TestFlight upload/processing verified in App Store Connect.
- [ ] Internal testing accepted on physical iPhone: login/session, uploads,
      Community, authorization, deletion, links, safe areas and keyboard.
- [ ] External tester beta metadata/review completed if external testing is used.
- [ ] Public App Store submission/release remains an explicit later decision.
