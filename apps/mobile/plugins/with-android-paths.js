const { withAppBuildGradle } = require("expo/config-plugins");

// Hash CMake object paths early enough to fit Windows' native build path limit.
module.exports = (config) =>
  withAppBuildGradle(config, (config) => {
    const marker = "// My Home Windows CMake paths";
    if (!config.modResults.contents.includes(marker)) {
      config.modResults.contents += `\n${marker}\nandroid {\n  externalNativeBuild {\n    cmake { buildStagingDirectory rootProject.file("../../../.local/cxx") }\n  }\n  defaultConfig {\n    externalNativeBuild {\n      cmake { arguments "-DCMAKE_OBJECT_PATH_MAX=240" }\n    }\n  }\n}\n`;
    }
    return config;
  });
