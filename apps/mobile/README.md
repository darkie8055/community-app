# Flutter resident and guard apps

See the [repository README](../../README.md) for setup, connected preview, Android flavors, Firebase mode and test commands. The Flutter app includes Social, Homes, Community, Buy & Sell and Stores, plus a separate guard workspace.

Entry points: `lib/main.dart` (switchable preview), `lib/main_resident.dart`, `lib/main_guard.dart` (standalone flavors). Without `API_BASE_URL` the app uses persisted local sample data. With an API URL it uses the NestJS backend. Set `AUTH_MODE=firebase` with Firebase options for verified phone sign-in.
