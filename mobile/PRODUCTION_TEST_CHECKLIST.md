# NOBI iPhone production test checklist

Use a product-owner-provided test account on a signed iPhone build. Do not create an account automatically.

Record the iPhone model, iOS version, app version/build and test timestamp.

## Authentication

- [ ] Register and confirm the real email-confirmation behavior.
- [ ] Log in with valid credentials.
- [ ] Verify invalid credentials show a safe error and do not log secrets.
- [ ] Background and terminate the app, reopen it, and verify Session Restore.
- [ ] Leave the app backgrounded across token expiry and verify refresh on resume.
- [ ] Log out and verify protected actions return to login.

## Community mutations

- [ ] Publish a post and verify it appears on Web and iPhone.
- [ ] Reply to a post and verify the reply appears on Web and iPhone.
- [ ] Like a post and verify count/state on Web and iPhone.
- [ ] Unlike the same post and verify count/state on Web and iPhone.
- [ ] Tap rapidly and confirm per-item pending state prevents duplicate mutations.
- [ ] Test mutation failure and verify optimistic state rolls back with a Toast.

## iPhone behavior

- [ ] Check 375×667, 390×844, 393×852 and 430×932 class devices or simulators.
- [ ] Verify notch/Dynamic Island, Home Indicator and status-bar spacing.
- [ ] Verify Login, Register, Publish and Reply with the software keyboard open.
- [ ] Verify native Share and its cancellation/error behavior.
- [ ] Verify background → active Session synchronization.
- [ ] Verify supported Universal Links after AASA and Associated Domains are deployed.
