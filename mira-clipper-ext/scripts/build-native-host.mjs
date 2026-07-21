import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "dist", "native");
const output = path.join(outputDir, "MiraWebBridgeHost.exe");
const temporaryOutput = path.join(outputDir, `.MiraWebBridgeHost.${process.pid}.tmp.exe`);
const source = path.join(root, "native-host", "launcher.c");
const reuseRunningHost = process.argv.includes("--reuse-running");
const hostScript = path.join(root, "native-host", "host.mjs");
fs.mkdirSync(outputDir, { recursive: true });
fs.rmSync(temporaryOutput, { force: true });

let reusedRunningHost = false;
try {
  execFileSync("gcc", ["-O2", "-s", "-static", "-mconsole", "-o", temporaryOutput, source], { cwd: root, stdio: "inherit" });
  try {
    fs.rmSync(output, { force: true });
    fs.renameSync(temporaryOutput, output);
  } catch (error) {
    const isLocked = error?.code === "EPERM" || error?.code === "EACCES";
    if (isLocked && !reuseRunningHost) {
      throw new Error(`无法替换 ${output}：MiraWebBridgeHost.exe 正在运行。请关闭 Chrome 或先断开 Native Messaging 后重试。`);
    }
    if (!reuseRunningHost || !fs.existsSync(output) || !isLocked) {
      throw error;
    }
    reusedRunningHost = true;
  }
} catch (error) {
  throw error;
} finally {
  fs.rmSync(temporaryOutput, { force: true });
}

fs.copyFileSync(hostScript, path.join(outputDir, "host.mjs"));
if (reusedRunningHost) {
  console.warn(`Native Host 正在运行，开发环境复用现有 exe：${output}`);
  console.warn("新的 launcher 变更将在 Native Host 下次重启后生效。");
} else {
  console.log(`Native Host launcher: ${output}`);
}
