import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const packagePaths = [
  path.join(rootDir, "package.json"),
  path.join(rootDir, "desktop", "package.json"),
  path.join(rootDir, "server", "package.json"),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
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

console.log("Version sync complete.");
