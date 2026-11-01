# Deployment and service setup

The repository includes Dockerfiles and infrastructure configuration; it has not been deployed to a cloud account. Container builds and live Redis/FCM/S3 delivery require the corresponding runtimes/credentials. Local database tests use PGlite's PostgreSQL engine.

## Native PostgreSQL and Redis

1. Install Docker or use managed PostgreSQL/Redis. For local Compose, set `POSTGRES_PASSWORD` in your shell and run `docker compose up -d` from the repository root.
2. In `apps/api/.env`, set `DB_MODE=postgres`, a privileged `MIGRATION_DATABASE_URL`, a **different** runtime `DATABASE_URL`, and `REDIS_URL`. Use a runtime password of at least 16 characters.
3. Run `npm run db:migrate`, then `npm run provision -w @mycommunity/api`. Provisioning grants the runtime login the application, worker and internal platform roles. The runtime login is not a table owner or PostgreSQL superuser.
4. For an empty production database, set `ADMIN_EMAIL`, `ADMIN_NAME`, and a strong `ADMIN_PASSWORD` in the operator environment; run `npm run create-admin -w @mycommunity/api`. This command uses migration credentials and creates the initial platform administrator. Do not expose migration credentials to the running API.
5. Set `NODE_ENV=production`, `DEMO_MODE=false`, `SEED_DEMO=false`, a random `JWT_SECRET`, and exact HTTPS `CORS_ORIGINS` for the admin/mobile web origins.

Migration and provision commands have compiled counterparts in `apps/api/dist/src/` for containers. Migrations are run by the deployment/operator, not by native production API startup. Back up native PostgreSQL independently; `.local/postgres` is only a local demo database.

## Firebase

1. Create Firebase apps for `com.mycommunity.mycommunity.resident` and `.guard`, plus the final iOS bundle IDs and optional web preview app.
2. Enable Phone Authentication and configure Android SHA fingerprints, authorized web domains and iOS verification/APNs requirements. Use Firebase test phone numbers in a development project.
3. Set `FIREBASE_PROJECT_ID` in the API. Copy `apps/mobile/config/firebase.example.json` to a local configuration and fill in platform-specific Firebase public options. Build with `--dart-define-from-file=<your-config.json>`. Keep service-account credentials on the server; never put them in Dart defines.
4. For FCM, set server `GOOGLE_CLOUD_PROJECT`, Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` or workload identity), `REDIS_URL` and `FCM_ENABLED=true`. Grant only the required messaging role and enable the FCM API.
5. In the authenticated mobile Profile screen, choose **Enable notifications**. The app requests OS permission, registers the FCM token and handles taps. Native Crashlytics is initialized with the notification integration. Configure Android notification defaults and iOS APNs capabilities before a signed release. Web push additionally needs a Firebase messaging service worker and VAPID configuration; the local preview uses its in-app inbox.

Firebase token signatures/audience/issuer are verified on the backend. New users receive no society access until membership approval. Phone sign-in and push have not been exercised against a real Firebase project without your project configuration.

## Object storage

Set `S3_BUCKET`, `S3_REGION=ap-south-1`, optional `S3_ENDPOINT`, and standard AWS SDK credentials/workload role. Keep the bucket private. Grant API read/write only within the application's bucket. Configure bucket CORS for your frontend origins and PUT/GET with Content-Type headers. The API issues five-minute upload URLs and ten-minute read URLs for authorized images. Add lifecycle policies for abandoned uploads and your chosen retention requirements.

## Container hosting

```sh
docker build -f apps/api/Dockerfile -t mycommunity-api .
docker build -f apps/admin/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/v1 -t mycommunity-admin .
```

Use AWS Mumbai (`ap-south-1`) with an HTTPS load balancer, managed PostgreSQL, private Redis, private S3, and a secret store, or equivalent managed services. The API listens on port 4000 and admin on 3000. Restrict databases and Redis to the application's private network. Use `/v1/health` for API liveness. Run migrations as a separate deployment step, then start the restricted application container.

Before distributing native releases, configure final package/bundle IDs, Android keystore and signing, iOS schemes/provisioning/APNs, Firebase platform apps and HTTPS API URLs. iOS must be built on macOS. The repository does not contain signing keys or production service credentials.
