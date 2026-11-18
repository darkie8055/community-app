const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { mobileOptions, checkServer } = require("../configure.cjs");
const path = require("node:path");
const vm = require("node:vm");

// Exercise config generation without reading .env or writing provider files.
function nativeFixture() {
  const writes = new Map();
  const fakeFs = {
    existsSync: (file) => writes.has(path.resolve(file)),
    readFileSync: (file) => {
      const value = writes.get(path.resolve(file));
      if (value === undefined) throw new Error("Missing fixture file");
      return value;
    },
    mkdirSync() {},
    writeFileSync: (file, data) => writes.set(path.resolve(file), data),
  };
  const load = (file, dependencies, env = {}) => {
    const module = { exports: {} };
    const fixtureRequire = (name) =>
      Object.hasOwn(dependencies, name) ? dependencies[name] : require(name);
    vm.runInNewContext(
      readFileSync(file, "utf8"),
      {
        module,
        exports: module.exports,
        require: fixtureRequire,
        __dirname: path.dirname(path.resolve(file)),
        process: { env },
        console: { log() {}, error() {} },
        URL,
      },
      { filename: file },
    );
    return module.exports;
  };
  const generator = load("tools/configure.cjs", { "node:fs": fakeFs });
  const env = {
    NODE_ENV: "production",
    API_BASE_URL: "https://api.example.invalid",
    FIREBASE_PROJECT_ID: "fixture-project",
    FIREBASE_SENDER_ID: "1234567890",
    FIREBASE_ANDROID_API_KEY: "public-android-key",
    FIREBASE_IOS_API_KEY: "public-ios-key",
    FIREBASE_STORAGE_BUCKET: "fixture-project.appspot.com",
    JWT_SECRET: "private-signing-value",
    DATABASE_URL: "private-database-value",
    AWS_SECRET_ACCESS_KEY: "private-storage-value",
    GOOGLE_APPLICATION_CREDENTIALS: "private-service-account-path",
  };
  for (const role of ["resident", "guard"]) {
    env[`FIREBASE_ANDROID_${role.toUpperCase()}_APP_ID`] =
      `1:1234567890:android:${role}`;
    env[`FIREBASE_IOS_${role.toUpperCase()}_APP_ID`] =
      `1:1234567890:ios:${role}`;
    env[`FIREBASE_IOS_${role.toUpperCase()}_BUNDLE_ID`] =
      `com.myhome.${role}`;
  }
  return {
    writes,
    generator,
    env,
    config: (role, mode) =>
      load(
        "apps/mobile/app.config.js",
        {
          "node:fs": fakeFs,
          "../../tools/configure.cjs": { ...generator, environment: () => env },
        },
        { APP_VARIANT: role, ...(mode ? { APP_MODE: mode } : {}) },
      )(),
  };
}
test("public mobile build config excludes every server secret", () => {
  const env = {
    API_BASE_URL: "https://api.example.invalid",
    FIREBASE_PROJECT_ID: "fixture",
    FIREBASE_SENDER_ID: "123",
    FIREBASE_ANDROID_API_KEY: "public-key",
    FIREBASE_ANDROID_RESIDENT_APP_ID: "public-resident-app",
    FIREBASE_ANDROID_GUARD_APP_ID: "public-guard-app",
    JWT_SECRET: "private-signing-value",
    DATABASE_URL: "private-database-value",
    MIGRATION_DATABASE_URL: "private-owner-value",
    AWS_SECRET_ACCESS_KEY: "private-storage-value",
    GOOGLE_APPLICATION_CREDENTIALS: "private-file-path",
    ANDROID_KEYSTORE_PASSWORD: "private-signing-password",
  };
  const resident = mobileOptions(env, "resident", "android");
  assert.equal(resident.FIREBASE_APP_ID, "public-resident-app");
  assert.equal(
    mobileOptions(env, "guard", "android").FIREBASE_APP_ID,
    "public-guard-app",
  );
  assert.equal(JSON.stringify(resident).includes("private-"), false);
  assert.equal(Object.keys(resident).length, 6);
});
test("missing credentials stop server configuration instead of supplying defaults", () => {
  assert.throws(() => checkServer({}), /Complete .env/);
  assert.throws(() => mobileOptions({}, "invalid", "android"), /Invalid app/);
});
test("backend authentication and storage remain provider-backed", () => {
  for (const file of [
    "apps/api/src/main.ts",
    "apps/api/src/auth/auth.ts",
    "apps/api/src/database/database.ts",
    "apps/mobile/src/api.ts",
  ]) {
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /authenticateDemo|auth\/demo|DEMO_MODE|SEED_DEMO|PGlite|DemoRepository/,
    );
  }
});

test("both native variants generate matching Firebase identities without server secrets", () => {
  const f = nativeFixture();
  for (const role of ["resident", "guard"]) {
    for (const platform of ["android", "ios"])
      f.generator.configureMobile(f.env, role, platform);
    const androidFile = [...f.writes.entries()].find(([file]) =>
      file.endsWith(`${role}.google-services.json`),
    )[1];
    const android = JSON.parse(androidFile);
    assert.equal(
      android.client[0].client_info.android_client_info.package_name,
      `com.myhome.${role}`,
    );
    assert.equal(
      android.client[0].client_info.mobilesdk_app_id,
      f.env[`FIREBASE_ANDROID_${role.toUpperCase()}_APP_ID`],
    );
    const plist = [...f.writes.entries()].find(([file]) =>
      file.endsWith(`${role}.GoogleService-Info.plist`),
    )[1];
    assert.match(
      plist,
      new RegExp(
        `<key>BUNDLE_ID</key><string>com\\.myhome\\.${role}</string>`,
      ),
    );
    assert.ok(
      plist.includes(f.env[`FIREBASE_IOS_${role.toUpperCase()}_APP_ID`]),
    );
    const config = f.config(role);
    assert.equal(config.android.package, `com.myhome.${role}`);
    assert.equal(
      config.ios.bundleIdentifier,
      `com.myhome.${role}`,
    );
    assert.equal(config.extra.role, role);
    assert.equal(config.extra.android.configured, true);
    assert.equal(config.extra.ios.configured, true);
    assert.deepEqual(Object.keys(config.extra).sort(), [
      "android",
      "ios",
      "role",
      "web",
    ]);
    assert.deepEqual(Object.keys(config.extra.android).sort(), [
      "apiUrl",
      "configured",
      "demo",
    ]);
    assert.equal(JSON.stringify(config).includes("private-"), false);
    assert.equal(config.extra.android.demo, false);
    assert.equal(config.extra.ios.demo, false);
    assert.equal(config.extra.web.demo, true);
    for (const plugin of ["app", "auth", "messaging", "crashlytics"])
      assert.ok(config.plugins.includes(`@react-native-firebase/${plugin}`));
    const build = config.plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-build-properties",
    )[1];
    assert.equal(build.android.usesCleartextTraffic, false);
    // Firebase Apple SDK 13+ in RNFirebase 27 uses Swift Package Manager.
    assert.equal(build.ios.useFrameworks, "dynamic");
    assert.ok(
      config.ios.infoPlist.UIBackgroundModes.includes("remote-notification"),
    );
    assert.equal(config.ios.entitlements["aps-environment"], "development");
  }
  for (const contents of f.writes.values())
    assert.equal(contents.includes("private-"), false);
});

test("unconfigured native variants do not initialize Firebase or invent an endpoint", () => {
  const f = nativeFixture();
  for (const role of ["resident", "guard"]) {
    for (const platform of ["android", "ios"])
      f.generator.configureMobile({}, role, platform, true);
    const config = f.config(role);
    assert.equal(config.extra.android.configured, false);
    assert.equal(config.extra.ios.configured, false);
    assert.equal(config.extra.android.apiUrl, "");
    assert.equal(config.extra.ios.apiUrl, "");
    assert.equal(config.extra.android.demo, true);
    assert.equal(config.extra.ios.demo, true);
    assert.equal(
      config.plugins.some(
        (p) => typeof p === "string" && p.startsWith("@react-native-firebase/"),
      ),
      false,
    );
  }
});

test("explicit live mode never falls back to demo when credentials are missing", () => {
  const f = nativeFixture();
  for (const role of ["resident", "guard"]) {
    for (const platform of ["android", "ios"])
      f.generator.configureMobile({}, role, platform, true);
    const config = f.config(role, "live");
    for (const platform of ["android", "ios", "web"]) {
      assert.equal(config.extra[platform].configured, false);
      assert.equal(config.extra[platform].demo, false);
    }
  }
});

test("explicit demo mode ignores existing provider files and strips API endpoints", () => {
  const f = nativeFixture();
  for (const role of ["resident", "guard"]) {
    for (const platform of ["android", "ios"])
      f.generator.configureMobile(f.env, role, platform);
    const config = f.config(role, "demo");
    for (const platform of ["android", "ios", "web"]) {
      assert.equal(config.extra[platform].configured, false);
      assert.equal(config.extra[platform].demo, true);
      assert.equal(config.extra[platform].apiUrl, "");
    }
    assert.equal(config.android.googleServicesFile, undefined);
    assert.equal(config.ios.googleServicesFile, undefined);
    assert.equal(
      config.plugins.some(
        (p) => typeof p === "string" && p.startsWith("@react-native-firebase/"),
      ),
      false,
    );
    assert.equal(JSON.stringify(config).includes("api.example.invalid"), false);
  }
});

test("mobile config rejects credentials embedded in an API URL and escapes native plist values", () => {
  const f = nativeFixture();
  for (const API_BASE_URL of [
    "https://user:secret@api.example.invalid",
    "https://api.example.invalid/v1",
    "https://api.example.invalid/?token=secret",
  ]) {
    assert.throws(
      () =>
        f.generator.configureMobile(
          { ...f.env, API_BASE_URL },
          "resident",
          "ios",
        ),
      /API_BASE_URL must be the API origin/,
    );
  }
  assert.equal(f.writes.size, 0);
  f.generator.configureMobile(
    { ...f.env, FIREBASE_STORAGE_BUCKET: 'test<&"bucket' },
    "resident",
    "ios",
  );
  const plist = [...f.writes.entries()].find(([file]) =>
    file.endsWith(".plist"),
  )[1];
  assert.ok(plist.includes("test&lt;&amp;&quot;bucket"));
});
