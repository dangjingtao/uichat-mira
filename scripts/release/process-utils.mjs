import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const defaultOptions = {
  stdio: "inherit",
  windowsHide: true,
};

function logInvocation(executable, args, cwd) {
  console.log(`> executable: ${executable}`);
  console.log(`> args: ${JSON.stringify(args)}`);
  console.log(`> cwd: ${cwd}`);
}

export function runExecutable(executable, args = [], options = {}) {
  const cwd = options.cwd ?? process.cwd();
  logInvocation(executable, args, cwd);
  return execFileSync(executable, args, {
    ...defaultOptions,
    ...options,
    cwd,
    env: options.env ?? process.env,
  });
}

export function runNode(scriptPath, args = [], options = {}) {
  return runExecutable(process.execPath, [scriptPath, ...args], options);
}

function resolvePnpmCli() {
  const npmExecPath = process.env.npm_execpath?.trim();
  if (npmExecPath && fs.existsSync(npmExecPath) && /pnpm/i.test(path.basename(npmExecPath))) {
    return npmExecPath;
  }
  return "";
}

export function runPnpm(args = [], options = {}) {
  const pnpmCli = resolvePnpmCli();
  if (pnpmCli) {
    return runExecutable(process.execPath, [pnpmCli, ...args], options);
  }

  if (process.platform === "win32") {
    throw new Error(
      "Cannot resolve pnpm's JavaScript CLI. Run this command through a pnpm script so npm_execpath is available; refusing to fall back to cmd.exe string parsing.",
    );
  }

  return runExecutable("pnpm", args, options);
}

function resolveNpmCli() {
  const candidates = [
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(path.dirname(path.dirname(process.execPath)), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? "";
}

export function runNpm(args = [], options = {}) {
  const npmCli = resolveNpmCli();
  if (npmCli) {
    return runExecutable(process.execPath, [npmCli, ...args], options);
  }

  if (process.platform === "win32") {
    throw new Error(
      "Cannot resolve npm-cli.js from the active Node installation; refusing to fall back to cmd.exe string parsing.",
    );
  }

  return runExecutable("npm", args, options);
}

export function captureExecutable(executable, args = [], options = {}) {
  const cwd = options.cwd ?? process.cwd();
  logInvocation(executable, args, cwd);
  return String(
    execFileSync(executable, args, {
      ...defaultOptions,
      ...options,
      cwd,
      env: options.env ?? process.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  ).trim();
}
