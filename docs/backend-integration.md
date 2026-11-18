# API and frontend integration

Updated 10 November 2026. Swagger is at `/docs`; endpoints use `/v1`.

`POST /auth/firebase` verifies a real Firebase ID token (signature, issuer, audience, expiry, phone provider and Indian phone format) before issuing a one-hour JWT. React Native uses Firebase Phone Authentication and refreshes its server session before expiry. Provider verification is not bypassed.

`POST /auth/login` accepts an administrator email/password. Passwords use bcrypt; unknown users receive equivalent password-verification work. The initial administrator is created through the operator CLI. There is no demo-auth endpoint.

Bearer tokens are required except health/login. Approved membership is checked on community operations; a client role does not grant permission.

| Domain | Routes beneath `/v1` |
| --- | --- |
| Onboarding | `/onboarding/communities`, `/onboarding/communities/:id/units`, `/onboarding/memberships` |
| Societies | `/communities`; community `/structure`, `/blocks`, `/floors`, `/units` |
| Membership | Community `/memberships`, decisions, `/my-memberships`, `/staff`, `/directory` |
| Visitors | Community `/visitor-entries`, entry detail, `/decision`, `/check-in`, `/check-out` |
| QR | Entry `/pass`; community `/visitor-passes/verify` and `/visitor-passes/check-in` |
| Inbox/device | `/notifications`, `/notifications/read`, `/devices` |
| Catalog | Community `/items`, item actions, `/inquiries`, `/service-requests` |
| Storage | Community `/uploads` for signed uploads |

Swagger is the exact DTO/parameter reference. Visitor/item lists use bounded cursor pagination and server filtering. Unchanged visitor-creation retries reuse their `Idempotency-Key` UUID. Property posts require approved home details. Drafts are private to authors/authorized administrators. Enquiries are private to participants. Services/notices require an administrator; service requests require an approved home.

Root `.env` supplies Next's public endpoint and allowlisted React Native API/Firebase values. `tools/configure.cjs` creates ignored client/native Firebase configuration; database, JWT, AWS and service-account secrets never enter client builds. Build tools do not create provider projects or accounts.

Live API failures produce retry/error states, and empty servers produce empty lists. No local substitute records are created in live mode. Society changes and revoked access clear old tenant snapshots. QA fixtures remain in test source. The separate user-facing demo runs entirely in memory without contacting these endpoints or bypassing their authentication; see [demo instructions](demo.md).
