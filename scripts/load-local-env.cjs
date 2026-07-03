const fs = require("fs");
const path = require("path");

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function loadLocalEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const loaded = {};
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    const key = line.slice(0, equalsIndex).trim();
    if (!key || key.startsWith("#")) {
      continue;
    }

    const value = parseEnvValue(line.slice(equalsIndex + 1));
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
    loaded[key] = value;
  }

  return loaded;
}

module.exports = loadLocalEnv;
