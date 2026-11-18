const { spawn } = require("node:child_process");
const { randomBytes, createHmac } = require("node:crypto");
const { mkdirSync, createWriteStream } = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

// Each browser suite gets an isolated in-memory database and random test secret.
exports.testApi = function testApi(port, name) {
  const root = path.resolve(__dirname, "../..");
  const base = `http://127.0.0.1:${port}/v1`;
  mkdirSync(path.join(root, ".local/logs"), { recursive: true });
  const log = createWriteStream(
    path.join(root, `.local/logs/qa-${name}-api.log`),
  );
  const secret = randomBytes(32).toString("hex");
  const child = spawn(
    process.execPath,
    ["-r", "ts-node/register/transpile-only", "test/http-server.ts"],
    {
      cwd: path.join(root, "apps/api"),
      windowsHide: true,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        NODE_ENV: "test",
        JWT_SECRET: secret,
        REDIS_URL: "",
        FCM_ENABLED: "false",
        CORS_ORIGINS: "http://127.0.0.1:3000,http://127.0.0.1:8080",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  let listening = false;
  child.stdout.on("data", (chunk) => {
    if (chunk.toString().includes("My Home API ready")) listening = true;
  });
  process.once("exit", () => {
    if (child.exitCode === null) child.kill();
  });
  let spawnError;
  child.once("error", (error) => {
    spawnError = error;
  });
  return {
    base,
    token(role) {
      const ids = { resident: 'af7c9031-9705-489c-a68b-ef1866851902', guard: 'f448840e-be71-45ae-be19-3fc41a25b55d' };
      if (!ids[role]) throw new Error('Unknown fixture role');
      const encoded = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const jwt = encoded({alg:'HS256',typ:'JWT'}) + '.' + encoded({sub:ids[role],name:'Fixture user',platformAdmin:false,iss:'myhome',aud:'myhome-apps',exp:Math.floor(Date.now()/1000)+3600});
      return jwt + '.' + createHmac('sha256',secret).update(jwt).digest('base64url');
    },
    async ready() {
      for (let i = 0; i < 120; i++) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null)
          throw new Error(
            `Test API exited. See .local/logs/qa-${name}-api.log`,
          );
        try {
          if (listening && (await fetch(`${base}/health`)).ok) return;
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("Test API startup timed out.");
    },
    async request(route, token, body, method = "POST", headers = {}) {
      const response = await fetch(`${base}${route}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      assert.ok(response.ok, `${method} ${route}: ${text}`);
      return data;
    },
    async stop() {
      if (child.exitCode === null) {
        await new Promise((resolve) => {
          child.once("close", resolve);
          child.kill();
        });
      }
      log.end();
    },
  };
};
