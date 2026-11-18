const {
  environment,
  configureMobile,
} = require("../../../tools/configure.cjs");
if (process.env.APP_MODE === "demo") {
  console.log("Building the offline demo; no provider credentials are needed.");
} else {
  const platform = process.env.EAS_BUILD_PLATFORM;
  if (!["android", "ios"].includes(platform))
    throw new Error("EAS_BUILD_PLATFORM is required.");
  configureMobile(
    environment(),
    process.env.APP_VARIANT || "resident",
    platform,
  );
}
