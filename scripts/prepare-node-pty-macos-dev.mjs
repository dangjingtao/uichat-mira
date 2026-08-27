import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

if (process.platform !== "darwin") {
  throw new Error("node-pty macOS development preparation requires darwin");
}

const serverRequire = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const nodePtyPackagePath = serverRequire.resolve("node-pty/package.json");
const spawnHelperPath = path.join(
  path.dirname(nodePtyPackagePath),
  "prebuilds",
  `darwin-${process.arch}`,
  "spawn-helper",
);

if (!fs.existsSync(spawnHelperPath)) {
  throw new Error(`node-pty spawn-helper is missing: ${spawnHelperPath}`);
}

const currentMode = fs.statSync(spawnHelperPath).mode & 0o777;
const executableMode = currentMode | 0o111;
if (currentMode !== executableMode) {
  fs.chmodSync(spawnHelperPath, executableMode);
  console.log(
    `[node-pty:mac] Restored spawn-helper executable mode: ${spawnHelperPath}`,
  );
} else {
  console.log(`[node-pty:mac] Reusing executable spawn-helper: ${spawnHelperPath}`);
}

fs.accessSync(spawnHelperPath, fs.constants.X_OK);
