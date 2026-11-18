const fs = require("node:fs");
const path = require("node:path");
const { parseEnv } = require("node:util");
const { randomBytes } = require("node:crypto");
const root = path.resolve(__dirname, "..");
function environment() {
  const file = path.join(root, ".env");
  return {
    ...(fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {}),
    ...process.env,
  };
}
function required(env, names) {
  const missing = names.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Complete .env: ${missing.join(", ")}`);
}
function write(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof data === "string" ? data : JSON.stringify(data, null, 2) + "\n",
  );
}
// Explicit allowlist. No database, signing, AWS, or service-account credentials enter this object.
function mobileOptions(env, app, target) {
  if (
    !["resident", "guard"].includes(app) ||
    !["android", "ios"].includes(target)
  )
    throw new Error("Invalid app or platform.");
  const platform = target.toUpperCase();
  return {
    API_BASE_URL: env.API_BASE_URL || "",
    FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || "",
    FIREBASE_SENDER_ID: env.FIREBASE_SENDER_ID || "",
    FIREBASE_API_KEY: env[`FIREBASE_${platform}_API_KEY`] || "",
    FIREBASE_APP_ID:
      env[`FIREBASE_${platform}_${app.toUpperCase()}_APP_ID`] || "",
    FIREBASE_IOS_BUNDLE_ID:
      target === "ios"
        ? env[`FIREBASE_IOS_${app.toUpperCase()}_BUNDLE_ID`] || ""
        : "",
  };
}
function configureMobile(env, app, target, allowUnconfigured = false) {
  const values = mobileOptions(env, app, target);
  try {
    required(values, [
      "API_BASE_URL",
      "FIREBASE_PROJECT_ID",
      "FIREBASE_SENDER_ID",
      "FIREBASE_API_KEY",
      "FIREBASE_APP_ID",
    ]);
    const url = new URL(values.API_BASE_URL);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    )
      throw new Error("API_BASE_URL must be the API origin, without /v1.");
    if (target === "ios") required(values, ["FIREBASE_IOS_BUNDLE_ID"]);
  } catch (error) {
    if (!allowUnconfigured) throw error;
    for (const key of Object.keys(values)) values[key] = "";
    console.log(
      "Writing unconfigured settings. APP_MODE=live shows setup UI; demo commands use local sample data.",
    );
  }
  const folder = path.join(root, "apps/mobile/config");
  const output = path.join(folder, `${app}.${target}.local.json`);
  write(output, values);
  if (target === "android" && values.FIREBASE_APP_ID) {
    write(path.join(folder, `${app}.google-services.json`), {
      project_info: {
        project_number: values.FIREBASE_SENDER_ID,
        project_id: values.FIREBASE_PROJECT_ID,
        storage_bucket: env.FIREBASE_STORAGE_BUCKET || "",
      },
      client: [
        {
          client_info: {
            mobilesdk_app_id: values.FIREBASE_APP_ID,
            android_client_info: {
              package_name: `com.myhome.${app}`,
            },
          },
          api_key: [{ current_key: values.FIREBASE_API_KEY }],
          oauth_client: [],
          services: { appinvite_service: { other_platform_oauth_client: [] } },
        },
      ],
      configuration_version: "1",
    });
  }
  if (target === "ios" && values.FIREBASE_APP_ID) {
    const xml = (value) =>
      String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    const fields = {
      API_KEY: values.FIREBASE_API_KEY,
      GOOGLE_APP_ID: values.FIREBASE_APP_ID,
      GCM_SENDER_ID: values.FIREBASE_SENDER_ID,
      PROJECT_ID: values.FIREBASE_PROJECT_ID,
      BUNDLE_ID: values.FIREBASE_IOS_BUNDLE_ID,
      STORAGE_BUCKET: env.FIREBASE_STORAGE_BUCKET || "",
      PLIST_VERSION: "1",
    };
    write(
      path.join(folder, `${app}.GoogleService-Info.plist`),
      `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict>` +
        Object.entries(fields)
          .map(([k, v]) => `<key>${k}</key><string>${xml(v)}</string>`)
          .join("") +
        "<key>IS_GCM_ENABLED</key><true/><key>IS_SIGNIN_ENABLED</key><true/></dict></plist>\n",
    );
  }
  return output;
}
function checkServer(env) {
  required(env, [
    "DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "JWT_SECRET",
    "REDIS_URL",
    "FIREBASE_PROJECT_ID",
    "S3_BUCKET",
  ]);
  if (env.JWT_SECRET.length < 32)
    throw new Error("Use at least 32 random characters for JWT_SECRET.");
  for (const key of ["DATABASE_URL", "MIGRATION_DATABASE_URL"]) {
    if (!["postgres:", "postgresql:"].includes(new URL(env[key]).protocol))
      throw new Error(`Invalid ${key}.`);
  }
  if (!["redis:", "rediss:"].includes(new URL(env.REDIS_URL).protocol))
    throw new Error("Invalid REDIS_URL.");
  if (
    env.GOOGLE_APPLICATION_CREDENTIALS &&
    !fs.existsSync(path.resolve(root, env.GOOGLE_APPLICATION_CREDENTIALS))
  )
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS file does not exist.");
}
module.exports = { environment, mobileOptions, configureMobile, checkServer };
if (require.main === module) {
  try {
    const args = process.argv.slice(2),
      env = environment();
    if (args[0] === "init") {
      const file = path.join(root, ".env");
      if (!fs.existsSync(file))
        write(
          file,
          fs
            .readFileSync(path.join(root, ".env.example"), "utf8")
            .replace(
              /^JWT_SECRET=$/m,
              `JWT_SECRET=${randomBytes(32).toString("hex")}`,
            ),
        );
      console.log(".env is ready to edit. Existing values are preserved.");
    } else if (args[0] === "check") {
      checkServer(env);
      console.log(
        "Required environment values are present. Connection checks happen at startup.",
      );
    } else if (args[0] === "mobile")
      console.log(
        configureMobile(
          env,
          args[1] || "resident",
          args[2] || "android",
          args.includes("--allow-unconfigured"),
        ),
      );
    else
      throw new Error(
        "Usage: node tools/configure.cjs init | check | mobile resident|guard android|ios",
      );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
