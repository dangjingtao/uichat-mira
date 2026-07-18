import { spawn } from "node:child_process";

import type { TerminalProcessTreeMode } from "./runtime-contract.js";

export const killTerminalProcessTree = async (input: {
  pid?: number;
  mode: TerminalProcessTreeMode;
}) => {
  if (!input.pid) {
    return;
  }

  if (process.platform === "win32") {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(input.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      });
      killer.once("error", () => resolve());
      killer.once("close", () => resolve());
    });
    return;
  }

  try {
    if (input.mode === "posix_process_group") {
      process.kill(-input.pid, "SIGKILL");
    } else {
      process.kill(input.pid, "SIGKILL");
    }
  } catch {
    // Process may already have exited.
  }
};
