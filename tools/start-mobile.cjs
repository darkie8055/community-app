const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const target = process.argv[2] || "web";
if (!["web", "mobile", "android", "ios"].includes(target)) {
  console.error("Choose web, mobile, android or ios.");
  process.exit(1);
}
if (target === "ios" && process.platform !== "darwin") {
  console.error(
    "The iOS simulator needs macOS. Use npm start to open Expo Go on an iPhone, or npm run web for the browser.",
  );
  process.exit(1);
}
const cli = path.join(root, "node_modules", "expo", "bin", "cli");
if (!fs.existsSync(cli)) {
  console.error(
    "Run npm ci once at the project root, then run this command again.",
  );
  process.exit(1);
}
console.log(
  "Starting My Home with Expo.",
);
const child = spawn(
  process.execPath,
  [
    cli,
    "start",
    "--go",
    ...(target === "mobile" ? [] : [`--${target}`]),
    ...process.argv.slice(3),
  ],
  {
    cwd: path.join(root, "apps", "mobile"),
    env: { ...process.env, APP_MODE: "demo" },
    stdio: "inherit",
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 0;
});
