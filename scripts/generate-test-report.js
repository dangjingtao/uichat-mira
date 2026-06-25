import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, "..");
const desktopCoverageDir = path.join(projectRoot, "desktop", "coverage");

export function generateFrontendTestReport() {
  console.log("Generating frontend test coverage report...");

  execSync("pnpm --filter @ui-chat-mira/desktop test:coverage", {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (!fs.existsSync(desktopCoverageDir)) {
    throw new Error(`Coverage report not found: ${desktopCoverageDir}`);
  }

  console.log(`Coverage report generated: ${desktopCoverageDir}`);
  return desktopCoverageDir;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateFrontendTestReport();
}
