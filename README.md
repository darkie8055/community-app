# MyCommunity

Flutter resident and guard apps, a Next.js administration panel, and a NestJS/PostgreSQL backend. The resident UI follows the supplied MyGate references: beige surfaces, yellow actions, rounded white cards, icon grids and **Social · Homes · Community · Buy & Sell · Stores** navigation. Branding and sample content are MyCommunity's own.

## Included

- Society creation, block/floor/flat management, staff assignments, resident membership requests and administrator approval.
- Guard visitor registration, photos, resident approve/deny, approved-only entry, checkout, searchable history, notifications inbox and append-only audit records.
- Property listings restricted to approved owners, rent/buy filters, drafts, publication and closure.
- Buy & Sell categories, search, saved items, photos, private enquiries and seller replies.
- Community posts/comments, notices, resident directory and society staff directory.
- Service catalogue, preferred-date booking requests, cancellation, administrator acceptance and completion. These are requests; providers confirm availability and pricing. No payment is collected.
- Firebase phone sign-in integration, FCM registration/delivery adapters, native Crashlytics integration, Redis/BullMQ retries, authenticated visitor event streams, private S3 uploads/read URLs and Swagger.

## Start locally

Prerequisites: **Node 24**, **Flutter 3.47.9**, PowerShell 7 on Windows. Flutter is installed on this machine at `C:\Users\games\develop\flutter`.

```powershell
./tools/start-local.ps1
```

`tools/start-local.ps1` installs dependencies, builds all three applications and creates a missing API environment file with a random JWT secret. It never replaces an existing environment file. Use `-SkipBuild` when the builds are already present. API, admin and mobile logs go to `tmp/`. Stop its owned processes with `./tools/stop-local.ps1`.

| Local app | Address |
| --- | --- |
| Resident / guard Flutter preview | http://127.0.0.1:8080 |
| Society admin | http://127.0.0.1:3000 |
| Swagger | http://127.0.0.1:4000/docs |
| API health | http://127.0.0.1:4000/v1/health |

Seeded local administrator: **admin@mycommunity.local / Community@123**. Flutter's development phone screen uses **123456** and sends no SMS. The preview's sidebar or Profile screen switches between resident and guard accounts.

The connected Flutter preview uses the API database. To build it before starting the preview server:

```powershell
cd apps/mobile
flutter pub get
flutter build web --release --no-web-resources-cdn --dart-define=API_BASE_URL=http://127.0.0.1:4000 -t lib/main.dart
cd ../..
node tools/serve-mobile.cjs
```

On this Windows machine, if the shared Pub cache reports encryption/copy errors, set `$env:PUB_CACHE = 'C:\Users\games\Documents\ChatGPT\mycommunity app\.local\pub-cache'` before Flutter commands. Use `& 'C:\Users\games\develop\flutter\bin\flutter.bat'` when Flutter is not on PATH.

Without `API_BASE_URL`, Flutter runs an offline demonstration with persisted sample data. Each device/flavor has independent demo storage. With the API URL, resident and guard changes share the same PostgreSQL data and appear in admin.

## Database modes

The local default uses **PGlite**, an embedded PostgreSQL engine, persisted in `.local/postgres`. SQL migrations and row-level security run against it. This makes the local demo usable on this machine, which has no Docker/PostgreSQL service installed.

Native **PostgreSQL 17 + Redis** are configured in `docker-compose.yml`. Set `POSTGRES_PASSWORD`, start Compose, configure separate migration/runtime database URLs, run migrations, then provision the restricted runtime login. See [deployment instructions](docs/deployment.md). Production explicitly rejects embedded database mode and demo identities.

## Android and iOS

```sh
cd apps/mobile
flutter build apk --debug --flavor resident -t lib/main_resident.dart
flutter build apk --debug --flavor guard -t lib/main_guard.dart
```

The two Android flavors install independently. Outputs are in `apps/mobile/build/app/outputs/flutter-apk/`. Use `--dart-define=API_BASE_URL=http://10.0.2.2:4000` for the Android emulator, or an HTTPS API address for a physical device. A phone's `127.0.0.1` points to the phone itself. Debug builds allow local HTTP; release builds require HTTPS.

On this machine, the generated `apps/mobile/build/app` directory is a junction to `D:\CodexBuilds\mycommunity-20261101\app-source` to avoid filling C:. Source files remain in this repository. Fresh checkouts use Flutter's normal build location.

For Firebase phone sign-in, copy `apps/mobile/config/firebase.example.json` into a local configuration file, fill in your Firebase app's public options, and build with `--dart-define-from-file=<file>`. Register separate Firebase apps for the resident and guard package IDs. Native signing fingerprints and iOS APNs setup are still required in your Firebase project. iOS source is included; compilation/signing requires macOS and Xcode.

## Checks and source map

```sh
npm run build
npm run test:api
node tools/qa-admin.cjs # requires admin on port 3000 and Chrome; uses its own test DB
cd apps/mobile
flutter analyze
flutter test
```

- `apps/mobile`: Flutter screens, Riverpod state, local/API repositories, Firebase integration and platform runners.
- `apps/admin`: Next.js/React/TypeScript administration dashboard.
- `apps/api`: NestJS/TypeScript API, authorization, jobs, storage and operator commands.
- `database/migrations`: UUID/timestamptz schema, tenant RLS, composite foreign keys and audit protections.
- [Screen/feature map](docs/mvp-and-screens.md), [API integration](docs/backend-integration.md), [deployment and Firebase setup](docs/deployment.md), [asset sources](docs/assets.md).

Live SMS, FCM delivery, S3 uploads, managed PostgreSQL/Redis and public hosting require your service configuration. They are not provisioned by the local demo. No cloud deployment or payment-provider integration is implied.
