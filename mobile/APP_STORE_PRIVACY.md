# NOBI App Store privacy data review

Status: **REPOSITORY REVIEW COMPLETE / APP STORE CONNECT CONFIRMATION REQUIRED**.

This inventory describes the current mobile code and the planned Phase 4 backend. The Account Holder must compare it with production Supabase, Cloudflare and support operations before answering App Store Connect. It is not an automatically submitted Privacy Label.

| Apple data category               | Collected       | Linked to identity                          | Tracking | Purpose / evidence                                                                                        |
| --------------------------------- | --------------- | ------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| Contact Info → Email Address      | Yes             | Yes                                         | No       | Supabase Auth registration, login and account support                                                     |
| Identifiers → User ID             | Yes             | Yes                                         | No       | Supabase user/profile ID, post ownership, likes, blocks and reports                                       |
| User Content → Other User Content | Yes             | Yes                                         | No       | Community posts, replies, nicknames, avatars and report details                                           |
| Usage Data → Product Interaction  | Yes             | Yes for authenticated interactions          | No       | Likes, blocks, reports and deletion-request status; confirm production page-view configuration separately |
| Diagnostics / request logs        | Review required | Usually not intentionally linked by the App | No       | Supabase and Cloudflare operational/security logs may include network metadata                            |

Current mobile code does not request precise/coarse location, contacts, health, fitness, payment, purchase history, microphone, camera or photo-library access. It has no advertising SDK and no cross-app tracking code. Do not declare “Data Not Collected”: account and community data are collected when those features are used.

## Processing purposes

- App Functionality: authentication, profiles, posts, replies, likes and session restore.
- Developer Communications: user-initiated support and deletion requests.
- Fraud Prevention / Security: reports, blocks, moderation actions and operational security logs.
- Analytics: no mobile analytics SDK was found. Confirm whether production `page_views` is enabled and whether it applies to App traffic before submission.

## App Store Connect review questions

1. Confirm production log retention and whether IP/device metadata is retained or linked.
2. Confirm whether `page_views` records mobile activity and update Product Interaction accordingly.
3. Confirm support-mail retention and access controls.
4. Confirm deletion timelines, UGC anonymization policy and legally required retention.
5. Confirm the public URLs `https://www.nobistudio.com/privacy.html` and `https://www.nobistudio.com/support.html` after deployment.
6. Answer tracking “No” only while no data is combined for third-party advertising or cross-company tracking.

Capacitor iOS and CapacitorCordova dependencies include `PrivacyInfo.xcprivacy` files in `node_modules`. Validate that the final archive contains all required third-party SDK privacy manifests before upload.
