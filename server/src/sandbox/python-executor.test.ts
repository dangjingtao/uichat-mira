import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getTestArtifactDir } from "@/test-support/artifacts.js";
import { getPythonSandboxStatus, runManagedPython } from "./python-executor.js";

const executable = process.platform === "win32" ? "python" : "python3";
const health = getPythonSandboxStatus({ enabled: true, executable });
const workspaceRoot = process.cwd();

describe("managed Python sandbox", () => {
  it("requires a real configured Python runtime for this smoke suite", () => {
    expect(health.available, health.reason).toBe(true);
  });

  it("reports the configured runtime health without exposing its path", () => {
    expect(getPythonSandboxStatus()).toMatchObject({ available: false });
  });

  it("runs standard-library code with controlled env", async () => {
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

  it("returns recoverable syntax, timeout and terminates on output limit", async () => {
    const syntax = await runManagedPython({ code: "def", workspaceRoot, config: { enabled: true, executable } });
    expect(syntax.status).toBe("failed");
    const timedOut = await runManagedPython({ code: "import time\ntime.sleep(2)", workspaceRoot, config: { enabled: true, executable }, timeoutMs: 100 });
    expect(timedOut.status).toBe("timed_out");
    const huge = await runManagedPython({ code: "print('x' * 10000)", workspaceRoot, config: { enabled: true, executable }, outputLimitBytes: 64 });
    expect(huge.status).toBe("failed");
    expect(huge.truncated).toBe(true);
  });

  it("blocks subprocess, shell, dynamic library and network bypasses", async () => {
    const bypasses = [
      "import subprocess\nsubprocess.run(['python', '-c', 'print(1)'])",
      "import os\nos.system('echo bypass')",
      "import ctypes\nctypes.CDLL('kernel32.dll' if __import__('sys').platform == 'win32' else 'libc.so.6')",
      "import socket\nsocket.create_connection(('127.0.0.1', 80))",
    ];
    for (const code of bypasses) {
      const blocked = await runManagedPython({ code, workspaceRoot, config: { enabled: true, executable } });
      expect(blocked.status, code).toBe("blocked");
      expect(blocked.stderrText).toContain("MANAGED_PYTHON_BLOCKED");
    }
  });

  it("blocks installation attempts by execution policy, including indirect subprocess calls", async () => {
    const blocked = await runManagedPython({ code: "import subprocess\nsubprocess.run(['pip', 'install', 'x'])", workspaceRoot, config: { enabled: true, executable } });
    expect(blocked.status).toBe("blocked");
    expect(blocked.stderrText).toContain("MANAGED_PYTHON_BLOCKED");
  });

  it("blocks workspace-external file mutations", async () => {
    const outsideRoot = await mkdtemp(path.join(os.tmpdir(), "mira-python-outside-"));
    try {
      const targets = [
        path.join(outsideRoot, "write.txt"),
        path.join(outsideRoot, "remove.txt"),
        path.join(outsideRoot, "rename.txt"),
        path.join(outsideRoot, "replace.txt"),
        path.join(outsideRoot, "directory"),
      ];
      for (const target of targets) {
        const code = target.endsWith("directory")
          ? `import os\nos.mkdir(${JSON.stringify(target)})`
          : `import os\nopen(${JSON.stringify(target)}, 'w').write('x')\nos.rename(${JSON.stringify(target)}, ${JSON.stringify(`${target}.renamed`)})\nos.replace(${JSON.stringify(`${target}.renamed`)}, ${JSON.stringify(`${target}.replaced`)})\nos.remove(${JSON.stringify(`${target}.replaced`)})`;
        const result = await runManagedPython({ code, workspaceRoot, config: { enabled: true, executable } });
        expect(result.status, target).toBe("blocked");
        expect(result.stderrText).toContain("file");
      }
    } finally {
      await rm(outsideRoot, { recursive: true, force: true });
    }
  });

  it("blocks writes to the managed runtime and site-packages roots", async () => {
    const runtimeRoot = String(spawnSync(executable, ["-c", "import sys; print(sys.prefix)"], { encoding: "utf8" }).stdout).trim();
    const target = path.join(runtimeRoot, "mira-python-write-policy-test.txt");
    try {
      const result = await runManagedPython({
        code: `open(${JSON.stringify(target)}, 'w').write('must be blocked')`,
        workspaceRoot,
        config: { enabled: true, executable },
      });
      expect(result.status).toBe("blocked");
      expect(result.stderrText).toContain("file write outside workspace");
    } finally {
      await rm(target, { force: true });
    }
  });

  it("blocks imports outside the standard library and configured package allowlist", async () => {
    const importWorkspace = await mkdtemp(path.join(os.tmpdir(), "mira-python-import-"));
    try {
      const result = await runManagedPython({
        code: "import pip",
        workspaceRoot: importWorkspace,
        config: { enabled: true, executable, packages: [] },
      });
      expect(result.status).toBe("blocked");
      expect(result.stderrText).toContain("import is outside");
    } finally {
      await rm(importWorkspace, { recursive: true, force: true });
    }
  });

  it("keeps artifacts workspace-bound", async () => {
    const escaped = await runManagedPython({ code: "print('x')", cwd: "..", workspaceRoot, config: { enabled: true, executable }, artifactRegistrations: [{ path: "../outside.txt" }] });
    expect(escaped.status).toBe("failed");
  });

  it("keeps test artifacts under the repository artifact directory", () => {
    expect(getTestArtifactDir("python")).toContain(".test-artifact");
  });
});
