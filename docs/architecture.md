# Architecture

Updated 10 November 2026.

React Native resident/guard variants share TypeScript models, API services and UI components. Expo config fixes native identifiers and the live app role/API origin. Native Firebase provides live phone authentication, persisted identity, messaging and crash reporting. Approved server memberships remain required for live access.

The credential-free presentation mode uses a separate local demo transport and shared in-memory sample records. It renders the same screens and can switch resident/guard views without Firebase or network requests. `APP_MODE=demo` forces that mode, `APP_MODE=live` forces real services, and the default `auto` uses demo only when a platform is unconfigured. A failing configured live server never triggers demo data. EAS live profiles explicitly select live mode. See [demo operation](demo.md).

The live `Session` in `apps/mobile/src/api.ts` owns fetch, the short-lived in-memory JWT, selected society, memberships, visitor snapshots and inbox. Credentials refresh before expiry, and snapshots refresh every 15 seconds while foregrounded and when returning to the app. Generation checks discard late requests after workspace changes or logout. Revoked access clears tenant data. Catalog and QR screens use the existing endpoints; failed live writes never create substitute records.

React Navigation provides native screen navigation and Android back behavior. Safe-area and keyboard handling support both platforms. Shared UI retains the original colors, Manrope font, artwork and assets. QR passes use SVG rendering, native camera scanning, clipboard and OS sharing. Expo generates the native folders from app config.

Next.js keeps routes in `src/app` and management in `src/features`. Shared components and API types are separate.

## Nest modules

- `auth/`: administrator password login, verified Firebase token exchange and JWT guard.
- `communities/`: structure, memberships, visitor lifecycle and management endpoints.
- `memberships/`: discovery, onboarding, directory and staff assignment.
- `visitors/`: expiring QR/code passes and atomic check-in.
- `catalog/`: properties, listings, posts, notices, services, bookmarks, enquiries and requests.
- `database/`: PostgreSQL pool, tenant transactions and migrations.
- `notifications/`: Redis/BullMQ, transactional outbox, FCM and live events.
- `storage/`: authorized S3 object reads; upload endpoints issue signed URLs.
- `config/` and `cli/`: root environment loading and operator-only commands.

## Data and delivery

IDs are UUIDs; timestamps are UTC/timestamptz. Composite foreign keys bind children to their society. Relevant tables use forced row-level security. Request transactions select `community_app`, set user/community context and enforce approved roles. Residents see visits for their units. Worker and internal platform operations have separate roles.

Migration credentials own schema changes; runtime credentials are provisioned separately. API startup never migrates or seeds. PGlite is a development dependency imported only by the test helper. Six migrations cover foundation, notification inbox, platform roles, community modules, Firebase identity and visitor passes. Future schema changes belong in new migrations.

Visitor changes, audit records and notification outbox records commit together. BullMQ retries transient push errors and removes invalid tokens. In-app notifications remain database records. QR verification does not grant entry until check-in succeeds. Failed writes never create local substitute records.

Client configuration uses an explicit public-key allowlist. Docker excludes tests, fixtures, logs and credentials. Native Firebase/signing configuration and the root `.env` remain ignored.
