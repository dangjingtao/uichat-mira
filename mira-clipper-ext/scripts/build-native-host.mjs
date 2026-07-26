import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "dist", "native");
const output = path.join(outputDir, "MiraWebBridgeHost.exe");
const stagedOutput = path.join(
  outputDir,
  `.MiraWebBridgeHost.${process.pid}.tmp.exe`,
);
const source = path.join(root, "native-host", "launcher.c");
const reuseRunningHost = process.argv.includes("--reuse-running");
const hostScript = path.join(root, "native-host", "host.mjs");

const compilerTempRoot = process.env.RUNNER_TEMP?.trim() || os.tmpdir();
fs.mkdirSync(compilerTempRoot, { recursive: true });
const compilerWorkDir = fs.mkdtempSync(
  path.join(compilerTempRoot, "mira-native-host-"),
);
const compilerSource = path.join(compilerWorkDir, "launcher.c");
const compilerOutput = path.join(compilerWorkDir, "MiraWebBridgeHost.exe");

fs.mkdirSync(outputDir, { recursive: true });
fs.rmSync(stagedOutput, { force: true });
fs.copyFileSync(source, compilerSource);

let reusedRunningHost = false;
try {
  // MinGW's linker cannot reliably create an output file below a Unicode
  // Windows path. Compile both source and output in an ASCII-friendly system
  // temp directory, then let Node copy the finished binary back to the
  // requested project path.
  execFileSync(
    "gcc",
    [
      "-O2",
      "-s",
      "-static",
      "-mconsole",
      "-o",
      compilerOutput,
      compilerSource,
    ],
    { cwd: compilerWorkDir, stdio: "inherit" },
  );
  fs.copyFileSync(compilerOutput, stagedOutput);

  try {
    fs.rmSync(output, { force: true });
    fs.renameSync(stagedOutput, output);
  } catch (error) {
    const isLocked = error?.code === "EPERM" || error?.code === "EACCES";
    if (isLocked && !reuseRunningHost) {
      throw new Error(
        `无法替换 ${output}：MiraWebBridgeHost.exe 正在运行。请关闭 Chrome 或先断开 Native Messaging 后重试。`,
      );
    }
    if (!reuseRunningHost || !fs.existsSync(output) || !isLocked) {
      throw error;
    }
    reusedRunningHost = true;
  }
} finally {
  fs.rmSync(stagedOutput, { force: true });
  fs.rmSync(compilerWorkDir, { recursive: true, force: true });
}

fs.copyFileSync(hostScript, path.join(outputDir, "host.mjs"));
if (reusedRunningHost) {
  console.warn(`Native Host 正在运行，开发环境复用现有 exe：${output}`);
  console.warn("新的 launcher 变更将在 Native Host 下次重启后生效。");
} else {
  console.log(`Native Host launcher: ${output}`);
}
