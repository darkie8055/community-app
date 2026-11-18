# My Home

A community resident app built with React Native, Expo, and TypeScript. This monorepo contains two apps:

| App | Description | Tech |
|-----|-------------|------|
| `apps/mobile` | Resident & guard mobile app | React Native + Expo SDK 58 |
| `apps/api` | Backend REST API | NestJS + PostgreSQL + Redis |

---

## Prerequisites

Install these tools before running anything:

- **[Node.js 26.x](https://nodejs.org/)** with npm
- **[Expo Go](https://expo.dev/go)** (SDK 58 compatible) on your phone — for the mobile app
- **PostgreSQL 15+** and **Redis** — only needed for the API (or use Docker)

> **Note:** iOS builds require macOS. On Windows, use the web or Android targets.

---

## 1. Install Dependencies

Run this **once** from the project root:

```sh
npm ci
```

---

## 2. Run the Mobile App (Quickest Start)

```sh
npm start
```

This launches the **Expo dev server** (Metro Bundler). Once it starts:

- **Phone:** Make sure your phone and computer are on the **same Wi-Fi network**, then open **Expo Go** and scan the QR code shown in the terminal.
- **Browser:** Press `w` in the terminal, or run `npm run web` instead.
- **Android emulator:** Press `a` in the terminal (Android Studio must be installed).

> **Why doesn't the QR code appear in the AI terminal log?**
> Metro renders the QR code directly to your system terminal using TTY mode (`stdio: inherit`), so it only appears in the terminal window where you ran `npm start` — not in log files or AI chat. Open that terminal to see the QR code.

### Useful terminal shortcuts (while `npm start` is running)

| Key | Action |
|-----|--------|
| `w` | Open in browser |
| `a` | Open on Android emulator |
| `r` | Reload the app |
| `m` | Toggle the developer menu |
| `?` | Show all options |

---

## 3. Run the API Server

The API requires PostgreSQL and Redis. For a quick local setup, start them with Docker:

```sh
docker compose up -d
```

Then configure the environment and start the server:

```sh
# 1. Copy the example env file and fill in your values
cp .env.example .env

# 2. Run database migrations
npm run db:migrate

# 3. Start the API
npm run dev:api
```

The API runs at [http://127.0.0.1:4000](http://127.0.0.1:4000).

> See [docs/deployment.md](docs/deployment.md) for the full setup guide including Firebase, AWS S3, and production deployment.

---

## 4. Run Everything Together

Open two separate terminal windows and run:

```sh
# Terminal 1 — API
npm run dev:api

# Terminal 2 — Mobile app
npm start
```

---

## Demo Mode (No credentials needed)

All commands run in `demo` mode by default — no backend, Firebase, or `.env` needed. This is great for UI development and presentations.

```sh
npm run web   # Opens the mobile app in a browser with demo data
```

---

## Troubleshooting

**`npm ci` fails** — Make sure you're using Node.js 26.x. Run `node --version` to check.

**QR code not visible** — Check the terminal window where `npm start` was run, not the AI chat log. Metro outputs directly to the TTY.

**Phone can't connect** — Ensure your phone and computer are on the same Wi-Fi. If behind a firewall, try `npm run web` to test in a browser first.

**Metro stuck at "Starting Metro Bundler"** — Wait up to 60 seconds on first launch; it caches modules. If it hangs, press `Ctrl+C` and re-run `npm start`.

**Port already in use** — Another process may be using port 4000 (API) or 3000 (admin). Stop it or change `PORT` in `.env`.
