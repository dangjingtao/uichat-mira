import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const projectRoot = path.join(__dirname, "..");
export const artifactsRoot = path.join(projectRoot, ".artifacts");

export function removeDir(targetPath, label) {
  if (fs.existsSync(targetPath)) {
    try {
      fs.rmSync(targetPath, { recursive: true, force: true });
      console.log(`Removed ${label}: ${targetPath}`);
    } catch (error) {
      if (["EBUSY", "EPERM"].includes(error.code)) {
        console.warn(`Skipped locked ${label}: ${targetPath}`);
        return false;
      }

      throw error;
    }

    return true;
  }

  console.log(`No ${label} to clean: ${targetPath}`);
  return false;
}

export function cleanupArtifactsRoot() {
  return removeDir(artifactsRoot, "temporary .artifacts");
}
