# Credentials, deployment and releases

Updated 10 November 2026. No cloud deployment has been performed. Fill the root `.env`; `.env.example` describes the fields. `node tools/configure.cjs init` preserves existing values.

This guide is for real services. For a team presentation, run `npm run web` without any credentials; see the [demo guide](demo.md) for instructions and a field-by-field description of where future environment values come from.

## PostgreSQL and Redis

Use PostgreSQL 15+ (local Compose specifies 17) and Redis. For local infrastructure, set `POSTGRES_PASSWORD`, then run `docker compose up -d`. Create the database in your URLs. Use separate owner/runtime identities and percent-encode URL passwords.

1. `npm run db:migrate` applies migrations using `MIGRATION_DATABASE_URL`.
2. `npm run provision -w @my-home/api` creates a distinct runtime login when absent and grants its application/worker/platform roles. Its password must have at least 16 characters. Existing login passwords are preserved.
3. `npm run create-admin -w @my-home/api` uses `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` (12+ characters). Remove the password afterward.
4. Configure runtime database/Redis, JWT, Firebase, exact browser `CORS_ORIGINS`, storage and ADC; start the API or use `tools/start-local.ps1`.

Do not give the deployed request-serving process owner credentials. Startup never migrates or seeds. PGlite is only an isolated-test dependency. The old ignored local data directory is unused by runtime code.

Redis handles BullMQ notification retries and live-event transport. Keep it private. With `FCM_ENABLED=true`, the worker needs application default credentials: a local file referenced by `GOOGLE_APPLICATION_CREDENTIALS` (root-relative or absolute), or an appropriately configured workload identity/ADC integration. It does not simulate delivery when credentials are absent.

## Firebase

Register Android apps `com.myhome.resident` and `.guard`, your chosen iOS bundle IDs and optional web app in the same project as the API. Fill public API keys, app IDs, sender ID and project ID in `.env`. Enable Phone Authentication, required account billing/region settings, Android signing fingerprints, authorized web domains and APNs credentials in the provider consoles.

The configuration generator writes public JSON and variant-specific `google-services.json` / `GoogleService-Info.plist` files under `apps/mobile/config/`. Expo config plugins integrate native Firebase app/auth/messaging/Crashlytics. Only public API URLs, configured/demo flags, app role and optional public EAS project IDs enter Expo extras.

For iOS, set the Apple team and Firebase bundle ID. The auth plugin derives the reCAPTCHA URL scheme from the Firebase app ID; an explicit scheme may also be supplied. Remote-notification background mode and push entitlement are configured. Complete APNs/signing in Apple and Firebase consoles, then verify on a physical device. Crashlytics symbol processing is integrated by its native plugin and needs release verification.

Official setup references: [Expo with Firebase](https://docs.expo.dev/guides/using-firebase/), [Phone verification](https://rnfirebase.io/auth/phone-auth), [Messaging](https://rnfirebase.io/messaging/usage), [Crashlytics](https://rnfirebase.io/crashlytics/usage).

## Storage

Set `S3_BUCKET`, `S3_REGION`, optional `S3_ENDPOINT`, and AWS SDK credentials or an IAM role. Leave explicit AWS keys blank when using a role. Keep the bucket private and configure browser CORS for presigned PUT uploads. Grant the API required object permissions only. Photos use supported image types, a 2 MB app limit, and authorized short-lived read URLs. Missing photos use neutral placeholders.

## Builds and hosting

`npm run build` creates NestJS and the standalone Next app. `tools/dev/serve-admin.cjs` places Next's public/static assets correctly. Rebuild after changing `NEXT_PUBLIC_*` values.

Use `tools/build-mobile.ps1 -App resident -Target android`, or select `guard`. For iOS on macOS generate configuration, then run `APP_VARIANT=resident npx expo run:ios` from `apps/mobile`. Regenerate native projects with Expo Prebuild when switching variants. Keep customizations in app config/plugins.

Store builds use EAS profiles in `apps/mobile/eas.json`. For example, run `npx eas-cli build --platform ios --profile resident-production` from `apps/mobile`. Configure public API/Firebase environment variables in EAS; the post-install hook generates native Firebase files remotely. Link an Expo project and configure EAS signing. Retain existing signing identities when updating an app. Do not distribute a template debug-signed build as a store release. Submission is a separate operator action.

The web export runs the local demo; live phone authentication is native. EAS production profiles force `APP_MODE=live`; explicit internal demo profiles skip provider configuration. Windows cannot generate or compile the iOS native project. Use macOS/Xcode or EAS.

Physical devices need a reachable HTTPS API. Android emulator loopback is `10.0.2.2`; physical phones need a LAN/hosted origin. Cleartext is only for local debugging. Deploy the API with private managed PostgreSQL/Redis, TLS, backups, injected secrets and exact CORS origins in AWS Mumbai or another suitable region. Docker excludes tests and credentials. Compiled operator jobs are in `dist/src/cli/`.

Before release verify real SMS, approved membership, visits, QR camera/sharing, private photo upload/read, FCM retries/delivery and crash ingestion. An `-AllowUnconfigured` compilation build is not a connected release.
