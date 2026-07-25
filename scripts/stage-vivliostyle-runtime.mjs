import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const artifactsRoot = path.join(projectRoot, ".artifacts");
const sourceRoot = path.join(artifactsRoot, "vivliostyle-runtime");
const destinations = [
  path.join(artifactsRoot, "server-bundle", "vivliostyle-runtime"),
  path.join(artifactsRoot, "electron-app", "backend", "vivliostyle-runtime"),
];

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`Missing staged Vivliostyle runtime: ${sourceRoot}`);
}

for (const destination of destinations) {
  const parent = path.dirname(destination);
  if (!fs.existsSync(parent)) {
    continue;
  }
  fs.rmSync(destination, { recursive: true, force: true });
  fs.cpSync(sourceRoot, destination, {
    recursive: true,
    dereference: true,
  });
  console.log(`Copied Vivliostyle runtime: ${destination}`);
}
