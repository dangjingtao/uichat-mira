import { describe, expect, it } from "vitest";
import { getTestArtifactDir } from "@/test-support/artifacts.js";
import { getPythonSandboxStatus, runManagedPython } from "./python-executor.js";

const executable = process.platform === "win32" ? "python" : "python3";
const health = getPythonSandboxStatus({ enabled: true, executable });
const workspaceRoot = process.cwd();

describe("managed Python sandbox", () => {
  it("reports the configured runtime health without exposing its path", () => {
    expect(getPythonSandboxStatus()).toMatchObject({ available: false });
  });

  it.skipIf(!health.available)("runs standard-library code with controlled env", async () => {
    const result = await runManagedPython({
      code: "import os\nprint('hello')\nprint(os.environ.get('RAG_DEMO_UNLISTED_SECRET', 'missing'))\nprint(os.environ.get('USERPROFILE', 'missing'))",
      workspaceRoot,
      config: { enabled: true, executable },
      timeoutMs: 5_000,
    });
    expect(result.status).toBe("completed");
    expect(result.stdoutText).toContain("hello");
    expect(result.stdoutText).toContain("missing");
  });

  it.skipIf(!health.available)("returns recoverable syntax, timeout and output results", async () => {
    const syntax = await runManagedPython({ code: "def", workspaceRoot, config: { enabled: true, executable } });
    expect(syntax.status).toBe("failed");
    const timedOut = await runManagedPython({ code: "import time\ntime.sleep(2)", workspaceRoot, config: { enabled: true, executable }, timeoutMs: 100 });
    expect(timedOut.status).toBe("timed_out");
    const huge = await runManagedPython({ code: "print('x' * 10000)", workspaceRoot, config: { enabled: true, executable }, outputLimitBytes: 64 });
    expect(huge.status).toBe("failed");
    expect(huge.truncated).toBe(true);
  });

  it.skipIf(!health.available)("blocks package installation and keeps artifacts workspace-bound", async () => {
    const blocked = await runManagedPython({ code: "import subprocess\nsubprocess.run('pip install x')", workspaceRoot, config: { enabled: true, executable } });
    expect(blocked.status).toBe("blocked");
    const escaped = await runManagedPython({ code: "print('x')", cwd: "..", workspaceRoot, config: { enabled: true, executable }, artifactRegistrations: [{ path: "../outside.txt" }] });
    expect(escaped.status).toBe("failed");
  });

  it("keeps test artifacts under the repository artifact directory", () => {
    expect(getTestArtifactDir("python")).toContain(".test-artifact");
  });
});
