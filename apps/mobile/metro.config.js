const { createHash } = require("node:crypto");
const { getDefaultConfig } = require("expo/metro-config");
const appConfig = require("./app.config");

const config = getDefaultConfig(__dirname);
// Expo embeds public app config into the web bundle. Separate its transform
// cache by configuration so a previous live build cannot mask demo mode.
const { name, slug, extra } = appConfig();
const publicConfigHash = createHash("sha256")
  .update(JSON.stringify({ name, slug, extra }))
  .digest("hex");
config.cacheVersion = `${config.cacheVersion ?? "1"}:${publicConfigHash}`;

module.exports = config;
