const fs = require("node:fs");
const path = require("node:path");
const { environment, mobileOptions } = require("../../tools/configure.cjs");

module.exports = () => {
  // Explicit demos never read the local credentials file or generated provider files.
  const env = process.env.APP_MODE === "demo" ? process.env : environment();
  const mode = process.env.APP_MODE || env.APP_MODE || "auto";
  if (!["auto", "demo", "live"].includes(mode))
    throw new Error("APP_MODE must be auto, demo or live.");
  const role = process.env.APP_VARIANT || "resident";
  if (!["resident", "guard"].includes(role))
    throw new Error("APP_VARIANT must be resident or guard.");
  const read = (platform) => {
    if (mode === "demo") return mobileOptions({}, role, platform);
    const file = path.join(__dirname, `config/${role}.${platform}.local.json`);
    return fs.existsSync(file)
      ? JSON.parse(fs.readFileSync(file, "utf8"))
      : mobileOptions(env, role, platform);
  };
  const android = read("android"),
    ios = read("ios");
  const google = `./config/${role}.google-services.json`,
    plist = `./config/${role}.GoogleService-Info.plist`;
  const hasAndroid =
    mode !== "demo" &&
    Boolean(android.API_BASE_URL) &&
    Boolean(android.FIREBASE_APP_ID) &&
    fs.existsSync(path.join(__dirname, google));
  const hasIos =
    mode !== "demo" &&
    Boolean(ios.API_BASE_URL) &&
    Boolean(ios.FIREBASE_APP_ID) &&
    fs.existsSync(path.join(__dirname, plist));
  const authScheme =
    mode !== "demo" && env[`FIREBASE_IOS_${role.toUpperCase()}_URL_SCHEME`];
  const platformConfig = (configured, apiUrl) => ({
    apiUrl: mode === "demo" ? "" : apiUrl,
    configured,
    demo: mode === "demo" || (mode === "auto" && !configured),
  });
  return {
    name: role === "guard" ? "My Home Guard" : "My Home",
    slug: `myhome-${role}`,
    version: "0.1.0",
    // "mycommunity" is kept as a legacy deep-link scheme so that QR passes
    // shared before the app was renamed to "My Home" continue to work for guards.
    // Do not remove it — residents' old invitation links use this scheme.
    scheme: role === "guard" ? ["myhome", "mycommunity"] : "myhome",
    icon:
      role === "resident" ? "./assets/resident-icon.png" : "./assets/icon.png",
    orientation: "portrait",
    userInterfaceStyle: "light",
    ios: {
      bundleIdentifier:
        ios.FIREBASE_IOS_BUNDLE_ID || `com.myhome.${role}`,
      supportsTablet: true,
      entitlements: { "aps-environment": "development" },
      ...(mode !== "demo" && env.APPLE_DEVELOPMENT_TEAM
        ? { appleTeamId: env.APPLE_DEVELOPMENT_TEAM }
        : {}),
      ...(hasIos ? { googleServicesFile: plist } : {}),
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
        ...(authScheme
          ? { CFBundleURLTypes: [{ CFBundleURLSchemes: [authScheme] }] }
          : {}),
      },
    },
    android: {
      package: `com.myhome.${role}`,
      ...(hasAndroid ? { googleServicesFile: google } : {}),
      permissions: ["android.permission.POST_NOTIFICATIONS"],
    },
    plugins: [
      "./plugins/with-android-paths",
      "expo-dev-client",
      "expo-font",
      "expo-sharing",
      "@react-native-community/datetimepicker",
      [
        "expo-camera",
        {
          cameraPermission: "Allow camera access to scan visitor QR passes.",
          recordAudioAndroid: false,
        },
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "Choose photos for your listings.",
          cameraPermission: "Take a visitor photo at the gate.",
          microphonePermission: false,
        },
      ],
      [
        "expo-build-properties",
        {
          ios: { useFrameworks: "dynamic" },
          android: {
            kotlinVersion: "2.4.0",
            usesCleartextTraffic: env.NODE_ENV !== "production",
          },
        },
      ],
      ...(hasAndroid || hasIos
        ? [
            "@react-native-firebase/app",
            "@react-native-firebase/auth",
            "@react-native-firebase/messaging",
            "@react-native-firebase/crashlytics",
          ]
        : []),
    ],
    // Only these public settings are serialized into the installed application.
    extra: {
      ...(env[`EAS_${role.toUpperCase()}_PROJECT_ID`]
        ? { eas: { projectId: env[`EAS_${role.toUpperCase()}_PROJECT_ID`] } }
        : {}),
      role,
      android: platformConfig(hasAndroid, android.API_BASE_URL),
      ios: platformConfig(hasIos, ios.API_BASE_URL),
      web: platformConfig(false, ""),
    },
  };
};
