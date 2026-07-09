import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ManagedCodeGraphProcessManager } from "./managed-codegraph-process-manager.js";
import { resolveManagedCodeGraphLaunchSpec } from "./managed-jsonrpc-session.js";
import { resolveManagedCodeGraphPlannerConfig } from "./planner-exposure-config.js";

type CommandCapture = {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const reportRoot = path.join(repoRoot, "server", "test-report");
const reportPrefix = "code_T015-codegraph-external-index-root";
const smokeRoot = path.join(
  os.tmpdir(),
  "uichat-mira-codegraph-external-index-root",
  new Date().toISOString().replace(/[:.]/g, "-"),
);

const ensureDir = (targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const writeText = (targetPath: string, content: string) => {
  ensureDir(path.dirname(targetPath));
  fs.writeFileSync(targetPath, content, "utf8");
};

const writeCapture = (name: string, capture: CommandCapture) => {
  const targetPath = path.join(reportRoot, `${reportPrefix}-${name}.txt`);
  writeText(
    targetPath,
    [`$ ${capture.command}`, "", capture.stdout, capture.stderr].filter(Boolean).join("\n"),
  );
  return targetPath;
};

const createTempRepo = (targetPath: string) => {
  ensureDir(path.join(targetPath, "src"));
  writeText(
    path.join(targetPath, "package.json"),
    `${JSON.stringify(
      {
        name: path.basename(targetPath),
        private: true,
        version: "0.0.0",
      },
      null,
      2,
    )}\n`,
  );
  writeText(
    path.join(targetPath, "src", "index.ts"),
    [
      "export function helloCodeGraph() {",
      "  return 'hello-codegraph';",
      "}",
      "",
    ].join("\n"),
  );
};

const runCommand = (
  command: string,
  args: string[],
  cwd: string,
  env?: Record<string, string>,
): CommandCapture => {
  const launch = resolveManagedCodeGraphLaunchSpec(command, args);
  const result = spawnSync(launch.command, launch.args, {
    cwd,
    windowsHide: true,
    encoding: "utf8",
    stdio: "pipe",
    env: {
      ...process.env,
      ...(env ?? {}),
    },
  });

  return {
    command: [launch.command, ...launch.args].join(" "),
    exitCode: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
};

const runSmoke = async () => {
  ensureDir(reportRoot);
  ensureDir(smokeRoot);

  const cleanRepoRoot = path.join(smokeRoot, "clean-repo");
  const externalIndexRoot = path.join(smokeRoot, "external-index-root");
  const appDataRoot = path.join(smokeRoot, "appdata");
  createTempRepo(cleanRepoRoot);
  ensureDir(externalIndexRoot);
  ensureDir(appDataRoot);

  const preexistingRepoRoot = path.join(smokeRoot, "preexisting-repo");
  createTempRepo(preexistingRepoRoot);
  const preexistingCodeGraphDir = path.join(preexistingRepoRoot, ".codegraph");
  ensureDir(preexistingCodeGraphDir);
  writeText(path.join(preexistingCodeGraphDir, "sentinel.txt"), "user-owned\n");

  process.env.UI_CHAT_CODEGRAPH_APP_DATA_ROOT = appDataRoot;
  delete process.env.UI_CHAT_CODEGRAPH_COMMAND;
  delete process.env.UI_CHAT_CODEGRAPH_START_ARGS;
  delete process.env.UI_CHAT_CODEGRAPH_VERSION_ARGS;
  delete process.env.UI_CHAT_CODEGRAPH_TELEMETRY_ARGS;

  const plannerConfig = resolveManagedCodeGraphPlannerConfig(cleanRepoRoot);
  const cleanRepoPreflightManager = new ManagedCodeGraphProcessManager({
    command: plannerConfig.command,
    startArgs: plannerConfig.startArgs,
    versionProbe: {
      args: plannerConfig.versionProbeArgs,
    },
    telemetryProbe: {
      args: plannerConfig.telemetryProbeArgs,
    },
    workspaceRoot: cleanRepoRoot,
    allowedWorkspaceRoot: cleanRepoRoot,
    logRoot: plannerConfig.logRoot!,
    indexRoot: plannerConfig.indexRoot!,
    repoPollutionGuard: {
      status: plannerConfig.externalIndexSupport.status,
      repoDataDirName: plannerConfig.externalIndexSupport.repoDataDirName,
      blockedReason: plannerConfig.externalIndexSupport.reason,
    },
  });
  const cleanRepoPreflightDetect = await cleanRepoPreflightManager.detect();
  const cleanRepoPreflightStart = await cleanRepoPreflightManager.start();
  const cleanRepoPreflightHealth = await cleanRepoPreflightManager.health();

  const versionCapture = runCommand("codegraph", ["--version"], cleanRepoRoot);
  const serveHelpCapture = runCommand("codegraph", ["serve", "--help"], cleanRepoRoot);
  const initHelpCapture = runCommand("codegraph", ["init", "--help"], cleanRepoRoot);
  const absoluteCodeGraphDirCapture = runCommand(
    "codegraph",
    ["init", cleanRepoRoot],
    cleanRepoRoot,
    {
      CODEGRAPH_DIR: externalIndexRoot,
      CODEGRAPH_TELEMETRY: "0",
      DO_NOT_TRACK: "1",
    },
  );

  const cleanRepoDotCodeGraph = path.join(cleanRepoRoot, ".codegraph");
  const cleanRepoPollution = {
    repoRoot: cleanRepoRoot,
    externalIndexRoot,
    repoDotCodeGraphExists: fs.existsSync(cleanRepoDotCodeGraph),
    repoDotCodeGraphEntries: fs.existsSync(cleanRepoDotCodeGraph)
      ? fs.readdirSync(cleanRepoDotCodeGraph)
      : [],
    externalIndexRootEntries: fs.readdirSync(externalIndexRoot),
  };

  const guard = {
    status: plannerConfig.externalIndexSupport.status,
    repoDataDirName: plannerConfig.externalIndexSupport.repoDataDirName,
    blockedReason: plannerConfig.externalIndexSupport.reason,
  } as const;

  const cleanRepoManager = new ManagedCodeGraphProcessManager({
    command: plannerConfig.command,
    startArgs: plannerConfig.startArgs,
    versionProbe: {
      args: plannerConfig.versionProbeArgs,
    },
    telemetryProbe: {
      args: plannerConfig.telemetryProbeArgs,
    },
    workspaceRoot: cleanRepoRoot,
    allowedWorkspaceRoot: cleanRepoRoot,
    logRoot: plannerConfig.logRoot!,
    indexRoot: plannerConfig.indexRoot!,
    repoPollutionGuard: guard,
  });

  const cleanRepoDetect = await cleanRepoManager.detect();
  const cleanRepoStart = await cleanRepoManager.start();
  const cleanRepoHealth = await cleanRepoManager.health();

  const preexistingPlannerConfig = resolveManagedCodeGraphPlannerConfig(preexistingRepoRoot);
  const preexistingManager = new ManagedCodeGraphProcessManager({
    command: preexistingPlannerConfig.command,
    startArgs: preexistingPlannerConfig.startArgs,
    versionProbe: {
      args: preexistingPlannerConfig.versionProbeArgs,
    },
    telemetryProbe: {
      args: preexistingPlannerConfig.telemetryProbeArgs,
    },
    workspaceRoot: preexistingRepoRoot,
    allowedWorkspaceRoot: preexistingRepoRoot,
    logRoot: preexistingPlannerConfig.logRoot!,
    indexRoot: preexistingPlannerConfig.indexRoot!,
    repoPollutionGuard: {
      status: "ready",
      repoDataDirName: ".codegraph",
      blockedReason: null,
    },
  });
  const preexistingDetect = await preexistingManager.detect();
  const preexistingStart = await preexistingManager.start();
  const preexistingHealth = await preexistingManager.health();

  const summary = {
    generatedAt: new Date().toISOString(),
    smokeRoot,
    cleanRepoRoot,
    preexistingRepoRoot,
    investigation: plannerConfig.externalIndexSupport,
    startupPolicy: {
      command: plannerConfig.command,
      startArgs: plannerConfig.startArgs,
      versionProbeArgs: plannerConfig.versionProbeArgs,
      telemetryProbeArgs: plannerConfig.telemetryProbeArgs,
      cwdStrategy: "cwd stays at project root; no repo-external index root is passed because CodeGraph 1.3.0 does not support it.",
    },
    captures: {
      version: writeCapture("version", versionCapture),
      serveHelp: writeCapture("serve-help", serveHelpCapture),
      initHelp: writeCapture("init-help", initHelpCapture),
      initWithAbsoluteCodeGraphDir: writeCapture(
        "init-with-absolute-codegraph-dir",
        absoluteCodeGraphDirCapture,
      ),
    },
    cleanRepoPollution,
    cleanRepoPreflightManager: {
      detect: cleanRepoPreflightDetect,
      start: cleanRepoPreflightStart,
      health: cleanRepoPreflightHealth,
    },
    cleanRepoManager: {
      detect: cleanRepoDetect,
      start: cleanRepoStart,
      health: cleanRepoHealth,
    },
    preexistingRepo: {
      dotCodeGraphExists: fs.existsSync(preexistingCodeGraphDir),
      sentinelContent: fs.readFileSync(path.join(preexistingCodeGraphDir, "sentinel.txt"), "utf8").trim(),
      detect: preexistingDetect,
      start: preexistingStart,
      health: preexistingHealth,
    },
    finalStatus:
      plannerConfig.externalIndexSupport.status === "blocked" &&
      cleanRepoPreflightStart.status === "blocked" &&
      cleanRepoPreflightHealth.status === "blocked" &&
      cleanRepoStart.status === "blocked" &&
      cleanRepoHealth.status === "blocked" &&
      cleanRepoPollution.repoDotCodeGraphExists &&
      cleanRepoPollution.externalIndexRootEntries.length === 0 &&
      preexistingDetect.status === "blocked" &&
      preexistingStart.status === "blocked"
        ? "PASS"
        : "BLOCKED",
  };

  writeText(
    path.join(reportRoot, `${reportPrefix}.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  const markdown = [
    "# code_T015 CodeGraph External Index Root / Repo Pollution Control",
    "",
    `- status: \`${summary.finalStatus}\``,
    `- smoke root: \`${smokeRoot}\``,
    "",
    "## Investigation",
    `- external index root supported: \`${plannerConfig.externalIndexSupport.externalIndexRootSupported}\``,
    `- CLI arg support: \`${plannerConfig.externalIndexSupport.investigation.cliArgSupported}\``,
    `- env path support: \`${plannerConfig.externalIndexSupport.investigation.envPathSupported}\``,
    `- config file path support: \`${plannerConfig.externalIndexSupport.investigation.configFilePathSupported}\``,
    `- cwd/project separation supported: \`${plannerConfig.externalIndexSupport.investigation.cwdProjectSeparationSupported}\``,
    `- serve --mcp project/index separation supported: \`${plannerConfig.externalIndexSupport.investigation.serveMcpProjectIndexSeparationSupported}\``,
    `- repo data dir env: \`${plannerConfig.externalIndexSupport.investigation.dataDirEnvName}\``,
    `- blocked reason: ${plannerConfig.externalIndexSupport.reason}`,
    "",
    "## Startup Policy",
    `- command: \`${plannerConfig.command}\``,
    `- start args: \`${JSON.stringify(plannerConfig.startArgs)}\``,
    `- version probe args: \`${JSON.stringify(plannerConfig.versionProbeArgs)}\``,
    `- telemetry probe args: \`${JSON.stringify(plannerConfig.telemetryProbeArgs)}\``,
    `- cwd strategy: ${summary.startupPolicy.cwdStrategy}`,
    "",
    "## Clean Repo Pollution Check",
    `- clean repo root: \`${cleanRepoRoot}\``,
    `- requested external index root: \`${externalIndexRoot}\``,
    `- manager preflight detect/start/health before any init: \`${cleanRepoPreflightDetect.status}\` / \`${cleanRepoPreflightStart.status}\` / \`${cleanRepoPreflightHealth.status}\``,
    `- repo-root .codegraph exists after \`CODEGRAPH_DIR=<absolute-path> codegraph init\`: \`${cleanRepoPollution.repoDotCodeGraphExists}\``,
    `- repo-root .codegraph entries: \`${cleanRepoPollution.repoDotCodeGraphEntries.join(", ") || "(empty)"}\``,
    `- external index root entries: \`${cleanRepoPollution.externalIndexRootEntries.join(", ") || "(empty)"}\``,
    `- manager detect/start/health after repo pollution appears: \`${cleanRepoDetect.status}\` / \`${cleanRepoStart.status}\` / \`${cleanRepoHealth.status}\``,
    "",
    "## Existing Repo-root .codegraph",
    `- preexisting repo root: \`${preexistingRepoRoot}\``,
    `- sentinel content preserved: \`${summary.preexistingRepo.sentinelContent}\``,
    `- manager detect/start/health: \`${preexistingDetect.status}\` / \`${preexistingStart.status}\` / \`${preexistingHealth.status}\``,
    "",
    "## Raw Outputs",
    `- version: \`${path.relative(repoRoot, summary.captures.version).replace(/\\/g, "/")}\``,
    `- serve --help: \`${path.relative(repoRoot, summary.captures.serveHelp).replace(/\\/g, "/")}\``,
    `- init --help: \`${path.relative(repoRoot, summary.captures.initHelp).replace(/\\/g, "/")}\``,
    `- init with absolute CODEGRAPH_DIR: \`${path.relative(repoRoot, summary.captures.initWithAbsoluteCodeGraphDir).replace(/\\/g, "/")}\``,
    `- summary json: \`${path.relative(repoRoot, path.join(reportRoot, `${reportPrefix}.json`)).replace(/\\/g, "/")}\``,
    "",
  ].join("\n");

  writeText(path.join(reportRoot, `${reportPrefix}.md`), `${markdown}\n`);
};

await runSmoke();
