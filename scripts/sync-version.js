import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packagePaths = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "electron", "package.json"),
  path.join(rootDir, "desktop", "package.json"),
  path.join(rootDir, "server", "package.json"),
  path.join(rootDir, "packages", "core", "package.json"),
  path.join(rootDir, "mira-clipper-ext", "package.json"),
];
const tauriConfigPath = path.join(rootDir, "tauri", "tauri.conf.json");
const tauriCargoPath = path.join(rootDir, "tauri", "Cargo.toml");
const extensionManifestPath = path.join(
  rootDir,
  "mira-clipper-ext",
  "extension",
  "manifest.json",
);
const rootExtensionManifestPath = path.join(
  rootDir,
  "mira-clipper-ext",
  "manifest.json",
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function syncCargoTomlVersion(filePath, version) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipped missing Cargo manifest: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const packageSectionMatch = content.match(
    /(\[package\][\s\S]*?^version = ")([^"]+)(")/m,
  );

  if (!packageSectionMatch) {
    console.warn(`Skipped Cargo manifest without [package] version: ${filePath}`);
    return;
  }

  const currentVersion = packageSectionMatch[2];
  if (currentVersion === version) {
    console.log(`Already up to date: ${filePath}`);
    return;
  }

  const updated = content.replace(
    /(\[package\][\s\S]*?^version = ")([^"]+)(")/m,
    `$1${version}$3`,
  );

  fs.writeFileSync(filePath, updated);
  console.log(`Updated ${filePath}`);
}

const rootPackage = readJson(packagePaths[0]);
const version = rootPackage.version;

console.log(`Syncing workspace package versions to ${version}...`);

for (const packagePath of packagePaths.slice(1)) {
  if (!fs.existsSync(packagePath)) {
    console.warn(`Skipped missing package file: ${packagePath}`);
    continue;
  }

  const packageJson = readJson(packagePath);
  if (packageJson.version === version) {
    console.log(`Already up to date: ${packagePath}`);
    continue;
  }

  packageJson.version = version;
  writeJson(packagePath, packageJson);
  console.log(`Updated ${packagePath}`);
}

if (fs.existsSync(tauriConfigPath)) {
  const tauriConfig = readJson(tauriConfigPath);
  if (tauriConfig.version === version) {
    console.log(`Already up to date: ${tauriConfigPath}`);
  } else {
    tauriConfig.version = version;
    writeJson(tauriConfigPath, tauriConfig);
    console.log(`Updated ${tauriConfigPath}`);
  }
} else {
  console.warn(`Skipped missing Tauri config: ${tauriConfigPath}`);
}

syncCargoTomlVersion(tauriCargoPath, version);

for (const manifestPath of [extensionManifestPath, rootExtensionManifestPath]) {
  if (!fs.existsSync(manifestPath)) continue;
  const extensionManifest = readJson(manifestPath);
  if (extensionManifest.version === version) {
    console.log(`Already up to date: ${manifestPath}`);
  } else {
    extensionManifest.version = version;
    writeJson(manifestPath, extensionManifest);
    console.log(`Updated ${manifestPath}`);
  }
}

console.log("Version sync complete.");
