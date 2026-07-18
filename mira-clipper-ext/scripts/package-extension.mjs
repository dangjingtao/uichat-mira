import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crx3 from "crx3";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(scriptDir, "..");
const sourceRoot = path.join(extensionRoot, "extension");
const modeArgIndex = process.argv.indexOf("--mode");
const mode = modeArgIndex >= 0 ? process.argv[modeArgIndex + 1] : "dev";

if (mode !== "dev" && mode !== "prod") {
  throw new Error(`Unsupported extension package mode: ${mode}. Use dev or prod.`);
}

const outputRoot = path.join(extensionRoot, "dist", mode);
const keyRoot = path.join(extensionRoot, ".keys");
const keyPath = process.env.MIRA_CLIPPER_CRX_KEY_PATH?.trim() ||
  path.join(keyRoot, `mira-clipper-${mode}.pem`);
const crxPath = path.join(outputRoot, "MiraClipper.crx");
const zipPath = path.join(outputRoot, "MiraClipper.zip");
const manifestPath = path.join(sourceRoot, "manifest.json");

await fs.access(manifestPath);
await fs.mkdir(outputRoot, { recursive: true });
await fs.mkdir(path.dirname(keyPath), { recursive: true });

await crx3([manifestPath], {
  keyPath,
  crxPath,
  zipPath,
});

console.log(`Packaged 见行 / MiraWebBrige (${mode})`);
console.log(`CRX: ${crxPath}`);
console.log(`ZIP: ${zipPath}`);
console.log(`Signing key: ${keyPath}`);
