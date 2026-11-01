# API and data integration

All clients use NestJS at `/v1`. Swagger is served at `/docs`; the JSON contract is `/docs-json`. Flutter's `BackendSession` handles the connected development accounts and Firebase token exchange. `ContentRepository` handles properties, marketplace, posts and service requests.

## Authentication

- `POST /auth/login`: administrator email/password → one-hour JWT.
- `POST /auth/demo`: fixed resident/guard identities, enabled only by development configuration.
- `POST /auth/firebase`: verified Firebase phone ID token plus display name → application account and one-hour JWT. The API verifies RS256 signature, issuer, audience, expiry, auth time and phone-provider claims against the configured project. It accepts Indian +91 mobile numbers.
- `GET /auth/me`: authenticated identity. Native Firebase SDK manages phone credentials; app access tokens are held in memory and refreshed through Firebase before expiry during active polling. Admin tokens are scoped to the browser tab's session storage.

Firebase sign-in creates no approved membership. A new resident chooses a society and flat under `/onboarding`, submits a pending membership, and receives access only after administrator approval. Guards/admins are assigned through the admin panel's Security team screen. Only platform admins can appoint society admins.

## Core routes

| Routes under `/v1` | Behavior |
| --- | --- |
| `GET/POST /communities` | List accessible societies / platform admin creates one |
| `/communities/:id/structure`, `/blocks`, `/floors`, `/units` | Structure lookup and administrator creation |
| `/communities/:id/memberships` and `/:membership/decision` | Request and approve/reject membership |
| `/communities/:id/visitor-entries` | Cursor-paginated logs and idempotent registration |
| `/visitor-entries/:entry/decision`, `/check-in`, `/check-out` | Resident decision and guard-controlled entry/exit |
| `/communities/:id/audit-logs` | Latest 100 immutable audit records |
| `/communities/:id/events` | Authenticated SSE visitor events; Redis pub/sub across API instances |
| `/notifications`, `/notifications/read` | User-specific inbox and read state |
| `POST/DELETE /devices` | User-owned FCM tokens |
| `/communities/:id/uploads` | Presigned private image upload, up to 2 MB |

Visitor registration requires a UUID `Idempotency-Key`. Repeating an identical terminal transition does not duplicate an entry/exit event. Illegal transitions are rejected. Client-side controls are not the authorization boundary.

## Added modules

`/communities/:id/items` stores typed `property`, `listing`, `post`, `notice`, and `service` records. Lists support kind, search, category, saved/mine filters and cursor pagination. Drafts/closed items are visible only to their authors and administrators. Only approved owners can list a flat. Notices/services are administrator-managed.

Item detail and mutations use `/items/:item`, `/status`, `/bookmark`, `/comments`, `/inquiries`, and `/requests`. Enquiries and replies are private to the sender/recipient. Service requests move from `requested` to `accepted` to `completed`; residents can cancel active requests but cannot confirm them. Catalogues and booking requests are society-scoped, not a cross-society marketplace or payment gateway.

## Database isolation

The first ten tables are `users`, `communities`, `blocks`, `floors`, `units`, `memberships`, `visitors`, `visitor_entries`, `devices`, and `audit_logs`. Extensions add a notification outbox and community-module tables.

Community-owned records have `community_id`, forced row-level security and composite tenant foreign keys. Request transactions set the `community_app` role and transaction-local user/community settings only after authentication; service methods validate approved membership and action permissions. Runtime PostgreSQL credentials differ from migration credentials. Worker/platform roles are reserved for internal operations. Audit rows are append-only at the database layer.

The in-app visitor inbox is persisted in the SQL outbox even when push is unconfigured. Redis/BullMQ handles asynchronous FCM delivery and exponential retries. The Flutter preview refreshes visitor state every six seconds; admin refreshes overview data every fifteen seconds. SSE is available to consumers that need immediate events. Signed photo URLs expire after ten minutes and are returned only for authorized rows.

## Configuration boundaries

The default build uses explicit demonstration identities. Configure Firebase and `AUTH_MODE=firebase` for verified phone sign-in. FCM delivery requires Redis, an enabled Firebase Cloud Messaging API, server credentials and registered device tokens. S3 requires a private bucket, SDK credentials/role and browser CORS for uploads. Production deployments must use TLS, native PostgreSQL, restricted runtime roles and external secret management.
