const fs = require("node:fs");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const mobile = path.join(root, "apps/mobile");
const cli = path.join(root, "node_modules/expo/bin/cli");
const action = process.argv[2] || "run";
if (!["prepare", "run", "metro"].includes(action)) {
  console.error("Choose prepare, run or metro.");
  process.exit(1);
}
if (!fs.existsSync(cli)) {
  console.error("Run npm ci from the project folder first.");
  process.exit(1);
}
const sdk = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA &&
    path.join(process.env.LOCALAPPDATA, "Android/Sdk"),
].find(
  (candidate) =>
    candidate && fs.existsSync(path.join(candidate, "platform-tools")),
);
const env = {
  ...process.env,
  APP_MODE: "demo",
  EXPO_NO_DEV_MENU: "1",
  ...(sdk
    ? {
        ANDROID_HOME: sdk,
        ANDROID_SDK_ROOT: sdk,
        PATH: [
          path.join(sdk, "platform-tools"),
          path.join(sdk, "emulator"),
          process.env.PATH,
        ].join(path.delimiter),
      }
    : {}),
};

if (action !== "metro") {
  const result = spawnSync(
    process.execPath,
    [cli, "prebuild", "--platform", "android", "--no-install"],
    {
      cwd: mobile,
      env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
  if (sdk) {
    const properties = path.join(mobile, "android/local.properties");
    const existing = fs.existsSync(properties)
      ? fs.readFileSync(properties, "utf8")
      : "";
    if (!/^sdk\.dir=/m.test(existing)) {
      fs.writeFileSync(
        properties,
        `${existing.trimEnd()}\nsdk.dir=${sdk.replaceAll("\\", "/")}\n`,
      );
    }
  }
}
if (action === "prepare") {
  console.log(
    `\nOpen this folder in Android Studio:\n${path.join(mobile, "android")}`,
  );
  console.log(
    "Run npm run android:metro in a terminal, then select the app configuration and press Run in Android Studio.",
  );
  process.exit(0);
}
console.log(
  "Starting My Home on Android.",
);
const args =
  action === "metro"
    ? ["start", "--dev-client", "--localhost", "--port", "8081"]
    : ["run:android", "--port", "8081"];
const child = spawn(
  process.execPath,
  [cli, ...args, ...process.argv.slice(3)],
  {
    cwd: mobile,
    env,
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
