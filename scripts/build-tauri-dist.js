import { execSync } from "node:child_process";
import { cleanupArtifactsRoot, projectRoot } from "./artifacts-utils.js";

try {
  execSync(
    "cross-env CARGO_BUILD_JOBS=1 CARGO_INCREMENTAL=0 pnpm tauri build --config tauri/tauri.conf.json",
    {
      cwd: projectRoot,
      stdio: "inherit",
    },
  );

  console.log("\n=== Cleaning temporary build artifacts ===");
  cleanupArtifactsRoot();
} catch (error) {
  console.error("Tauri build failed:", error.message);
  process.exit(1);
}
