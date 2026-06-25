import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");

function reportExists(coverageDir) {
  return fs.existsSync(path.join(coverageDir, "index.html"));
}

function generateFrontendReport() {
  const desktopCoverageDir = path.join(projectRoot, "desktop", "coverage");
  if (reportExists(desktopCoverageDir)) {
    console.log("[dev:coverage] Frontend coverage report already exists. Skipping.");
    return;
  }

  console.log("[dev:coverage] Generating frontend coverage report...");
  execSync("pnpm --filter @ui-chat-mira/desktop test:coverage", {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function generateServerReport() {
  const serverCoverageDir = path.join(projectRoot, "server", "coverage");
  if (reportExists(serverCoverageDir)) {
    console.log("[dev:coverage] Server coverage report already exists. Skipping.");
    return;
  }

  console.log("[dev:coverage] Generating server coverage report...");
  execSync("pnpm test:coverage", {
    cwd: path.join(projectRoot, "server"),
    stdio: "inherit",
  });
}

function main() {
  generateFrontendReport();
  generateServerReport();
  console.log("[dev:coverage] All coverage reports are ready.");
}

main();
