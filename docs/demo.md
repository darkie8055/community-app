# Run the team demo

You do **not** need an `.env` file, Firebase account, database, backend server or login credentials for the demo.

From the project root:

```sh
npm ci
npm run web
```

Run `npm ci` only for the first setup or after dependency changes. The second command opens the app in your browser. Stop it with Ctrl+C. The app keeps the same screens and design as the native mobile app.

To show it on a phone, install Expo Go compatible with this project's Expo SDK, connect the phone and computer to the same Wi-Fi, and run:

```sh
npm start
```

Scan the QR shown in the terminal with Expo Go on Android or the iPhone Camera app. `npm run ios` opens the iOS simulator on macOS through Expo Go. These demo routes do not load Firebase. The included date picker and view capture libraries support Expo Go ([date picker](https://docs.expo.dev/versions/latest/sdk/date-time-picker/), [view capture](https://docs.expo.dev/versions/latest/sdk/captureRef/)). A compatible Expo Go installation is required for this phone-preview route; the browser demo needs no phone tooling.

For **Android Studio**, use `npm run android:prepare`, open `apps/mobile/android`, start a device in Device Manager, and run `npm run android`. `npm run android` now also uses this native workflow. It compiles and installs the Android app without Expo Go. See the [Android Studio guide](android-studio.md) for using the IDE's Run button.

Extra Expo options are forwarded, for example `npm run web -- --port 8082` or `npm start -- --localhost`. The normal LAN option is appropriate for a physical phone on the same network.

## What the demo does

My Home opens with illustrated onboarding. Continue through the three screens or tap **Skip** to enter Maple Grove. On Social, tap **View More** to search features or browse categories. Use **My profile** for the demo role switch and data reset. Try approvals, invitations, QR passes, amenity reservations, household lists, posts and service requests.

Changes are local to this running app and reset when it reloads or you reset the demo. A resident and guard view in the same running app share the demo records; separate phones/browser tabs have separate records. Sample QR passes are only valid in that same demo workspace. SMS, push delivery, cloud uploads and database persistence are not connected. Photo selections stay on the device/in the browser session.

`npm run web` explicitly selects demo mode even if a partly filled `.env` already exists. It leaves that file untouched. Normal unconfigured mobile launches also open the demo. `APP_MODE=live` selects only the real backend and displays setup-required UI if its configuration is incomplete; it never silently converts a live API failure into sample data.

## Connect real services later

Keep presenting with the demo commands until your services are ready. Then run `node tools/configure.cjs init` at the root; this creates `.env` from the example when absent and preserves an existing file. Fill it using your own provider settings:

| Fields | Where the values come from |
| --- | --- |
| `DATABASE_URL`, `MIGRATION_DATABASE_URL` | PostgreSQL connection strings for a restricted runtime user and a separate database owner. See [deployment](deployment.md). |
| `REDIS_URL` | Your Redis connection URL. |
| `JWT_SECRET` | A random signing value. The `init` command generates one when creating a new file; do not keep changing it. |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SENDER_ID` | Firebase Console → Project settings → General: project ID and project number. |
| `FIREBASE_ANDROID_API_KEY`, Android resident/guard `APP_ID` fields | The corresponding Android app's `google-services.json`: `api_key.current_key` and `mobilesdk_app_id`. Register both package IDs shown in `app.config.js`. |
| `FIREBASE_IOS_API_KEY`, iOS resident/guard `APP_ID` and `BUNDLE_ID` fields | Each iOS app's `GoogleService-Info.plist`: `API_KEY`, `GOOGLE_APP_ID` and `BUNDLE_ID`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Server-only path to your local Firebase service-account JSON, or use your hosting platform's workload identity. Never copy this file into the mobile app. |
| `S3_BUCKET`, `S3_REGION`, storage credentials | Your private S3-compatible bucket and server permissions. |
| `API_BASE_URL` | The running API's reachable origin without `/v1`, e.g. an HTTPS host. Android emulator local API: `http://10.0.2.2:4000`; phones need your computer's LAN IP or a hosted endpoint. |
| `NEXT_PUBLIC_API_URL` | API origin plus `/v1`, for the admin website. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | The initial administrator account you choose; create it once with the provisioning commands. |

The demo needs none of these values. Provider setup also includes Firebase phone authentication, signing fingerprints/APNs and database migrations; follow [deployment](deployment.md) when moving to live mode.

For a live Android app, after the server and provider settings are ready:

```powershell
node tools/configure.cjs mobile resident android
$env:APP_MODE = 'live'
npm run android -w @my-home/mobile
```

Use `guard` for the other variant and `ios` with macOS/Xcode for iOS. Regenerate native projects when changing their configuration. EAS production profiles already force live mode; `resident-demo` and `guard-demo` are separate internal demo profiles. `./tools/build-mobile.ps1 -Demo -App resident -Target android` builds/runs the native demo using local Android tools. An EAS build still needs an Expo account and signing setup, even though demo data needs no backend credentials.

## Resident display name

The resident app displays **My Home**. Expo display names are in `apps/mobile/app.config.js`. Existing application IDs and the visitor-pass link scheme continue to identify the same installed app.
