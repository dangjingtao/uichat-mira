import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JSDOM } from "jsdom";
import { writeStructuredLog } from "@/logger";

const VIVLIOSTYLE_RUNTIME_VERSION = "11.1.0";
const VIVLIOSTYLE_TIMEOUT_MS = 180_000;
const MAX_CLI_OUTPUT = 1_000_000;

const existingPath = (value: string | undefined) => {
  const candidate = value?.trim();
  return candidate && fs.existsSync(candidate) ? candidate : undefined;
};

const resolveChromiumExecutable = () => {
  const configured =
    existingPath(process.env.MIRA_CHROMIUM_EXECUTABLE_PATH) ??
    existingPath(process.env.CHROME_PATH) ??
    existingPath(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH);
  if (configured) return configured;

  const candidates =
    process.platform === "win32"
      ? [
          process.env.LOCALAPPDATA
            ? path.join(
                process.env.LOCALAPPDATA,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Google",
                "Chrome",
                "Application",
                "chrome.exe",
              )
            : "",
          process.env.PROGRAMFILES
            ? path.join(
                process.env.PROGRAMFILES,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
          process.env["PROGRAMFILES(X86)"]
            ? path.join(
                process.env["PROGRAMFILES(X86)"]!,
                "Microsoft",
                "Edge",
                "Application",
                "msedge.exe",
              )
            : "",
        ]
      : process.platform === "darwin"
        ? [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
          ];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
};

const executableNames = () =>
  process.platform === "win32"
    ? ["vivliostyle.cmd", "vivliostyle.exe", "vivliostyle"]
    : ["vivliostyle"];

const ancestorPaths = (value: string, maxDepth = 5) => {
  const paths: string[] = [];
  let current = path.resolve(value);
  for (let depth = 0; depth < maxDepth; depth += 1) {
    paths.push(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return paths;
};

export const resolveVivliostyleCliExecutable = () => {
  const configured = existingPath(process.env.MIRA_VIVLIOSTYLE_CLI_PATH);
  if (configured) return configured;

  const resourcesPath = (
    process as NodeJS.Process & { resourcesPath?: string }
  ).resourcesPath;
  const roots = [
    ...ancestorPaths(process.cwd()),
    ...ancestorPaths(path.dirname(process.execPath)),
    ...(resourcesPath ? ancestorPaths(resourcesPath) : []),
  ];
  const candidateDirectories = new Set<string>();

  for (const root of roots) {
    candidateDirectories.add(path.join(root, "node_modules", ".bin"));
    candidateDirectories.add(
      path.join(
        root,
        ".local-runtimes",
        "vivliostyle",
        VIVLIOSTYLE_RUNTIME_VERSION,
        "node_modules",
        ".bin",
      ),
    );
    candidateDirectories.add(
      path.join(root, ".artifacts", "vivliostyle-runtime", "node_modules", ".bin"),
    );
    candidateDirectories.add(
      path.join(root, "vivliostyle-runtime", "node_modules", ".bin"),
    );
    candidateDirectories.add(
      path.join(root, "backend", "vivliostyle-runtime", "node_modules", ".bin"),
    );
    candidateDirectories.add(
      path.join(root, "server", "vivliostyle-runtime", "node_modules", ".bin"),
    );
  }

  for (const directory of candidateDirectories) {
    for (const name of executableNames()) {
      const candidate = path.join(directory, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return undefined;
};

export const resolveVivliostyleSpawnInvocation = (input: {
  cliPath: string;
  args: string[];
  platform?: NodeJS.Platform;
  comSpec?: string;
}) => {
  const platform = input.platform ?? process.platform;
  if (platform === "win32") {
    return {
      command:
        input.comSpec ??
        process.env.ComSpec ??
        process.env.COMSPEC ??
        "cmd.exe",
      args: ["/d", "/c", "call", input.cliPath, ...input.args],
      shell: false as const,
    };
  }
  return {
    command: input.cliPath,
    args: input.args,
    shell: false as const,
  };
};

const toCssString = (value: string) =>
  `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replace(/\r?\n/g, "\\A ")}"`;

const buildVivliostylePrintCss = (metadata: {
  brand: string;
  title: string;
  footer: string;
}) => `
@page mira-cover {
  size: A4;
  margin: 0;
  @top-left { content: none; }
  @top-right { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}

@page mira-report {
  size: A4;
  margin: 18mm 14mm 20mm;

  @top-left {
    content: ${toCssString(metadata.brand)};
    color: #766B79;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    font-size: 7.5pt;
    vertical-align: bottom;
    border-bottom: 0.2mm solid #DCCFE2;
    padding-bottom: 2mm;
  }

  @top-right {
    content: ${toCssString(metadata.title)};
    color: #766B79;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    font-size: 7.5pt;
    text-align: right;
    vertical-align: bottom;
    border-bottom: 0.2mm solid #DCCFE2;
    padding-bottom: 2mm;
  }

  @bottom-left {
    content: ${toCssString(metadata.footer)};
    color: #817486;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    font-size: 6.2pt;
    line-height: 1.35;
    vertical-align: top;
    border-top: 0.2mm solid #DCCFE2;
    padding-top: 2mm;
  }

  @bottom-right {
    content: "第 " counter(page) " 页";
    color: #817486;
    font-family: "Noto Sans SC", "Microsoft YaHei", sans-serif;
    font-size: 7pt;
    text-align: right;
    vertical-align: top;
    border-top: 0.2mm solid #DCCFE2;
    padding-top: 2mm;
  }
}

@media print {
  html, body {
    background: #fff !important;
  }

  .print-header,
  .print-footer {
    display: none !important;
  }

  .report {
    max-width: none !important;
    margin: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    overflow: visible !important;
  }

  .cover {
    page: mira-cover;
    break-after: page !important;
    min-height: 297mm !important;
    padding: 24mm 18mm 18mm !important;
  }

  .report > .section,
  .report > .report-footer {
    page: mira-report;
  }

  .section {
    padding: 7mm 0 !important;
  }

  .page-break {
    break-before: page !important;
  }

  .visual-grid {
    grid-template-columns: 1fr !important;
  }

  .visual-column + .visual-column {
    break-before: page !important;
  }

  .dimension-card {
    break-inside: auto !important;
    page-break-inside: auto !important;
  }

  .section-head,
  .dimension-title-row,
  .core-judgement,
  h2,
  h3,
  h4,
  figcaption {
    break-after: avoid-page !important;
  }

  .summary-block,
  .radar-figure,
  .score-bars,
  .detail-grid section,
  .gap-block,
  .closing-section > div:last-child {
    break-inside: avoid-page !important;
  }

  .summary-block,
  .dimension-card,
  .gap-block,
  .visual-column {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }

  p,
  li {
    orphans: 3;
    widows: 3;
  }

  .eyebrow {
    display: none !important;
  }
}
`;

export const prepareHtmlForVivliostyle = (html: string) => {
  const dom = new JSDOM(html);
  const { document } = dom.window;
  const headerParts = Array.from(document.querySelectorAll(".print-header span"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);
  const footerParts = Array.from(document.querySelectorAll(".print-footer span"))
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);

  document.querySelectorAll(".print-header, .print-footer").forEach((node) => {
    node.remove();
  });

  const style = document.createElement("style");
  style.id = "mira-vivliostyle-print";
  style.textContent = buildVivliostylePrintCss({
    brand: headerParts[0] || "Mira 专属评估服务",
    title: headerParts[1] || document.title || "专属评估报告",
    footer:
      footerParts[0] ||
      "本报告用于健康教育、信息整理和就诊准备，不替代专业医疗决策。",
  });
  document.head.append(style);
  return dom.serialize();
};

const appendCliOutput = (current: string, chunk: Buffer | string) =>
  `${current}${chunk.toString()}`.slice(-MAX_CLI_OUTPUT);

const runVivliostyle = async (input: {
  cliPath: string;
  browserPath: string;
  htmlPath: string;
  outputPath: string;
  cwd: string;
}) =>
  new Promise<void>((resolve, reject) => {
    const args = [
      "build",
      input.htmlPath,
      "--output",
      input.outputPath,
      "--executable-browser",
      input.browserPath,
      "--log-level",
      "silent",
      "--no-vite-config-file",
    ];
    const invocation = resolveVivliostyleSpawnInvocation({
      cliPath: input.cliPath,
      args,
    });
    const child = spawn(invocation.command, invocation.args, {
      cwd: input.cwd,
      env: {
        ...process.env,
        NO_COLOR: "1",
        PUPPETEER_SKIP_DOWNLOAD: "true",
        PUPPETEER_SKIP_CHROME_DOWNLOAD: "true",
      },
      windowsHide: true,
      shell: invocation.shell,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const logFailure = (details: {
      exitCode: number | null;
      signal: NodeJS.Signals | "timeout" | null;
      stderr: string;
    }) => {
      writeStructuredLog("warn", {
        scope: "skill-report-pdf",
        event: "vivliostyle-cli-failed",
        cliPath: input.cliPath,
        browserPath: input.browserPath,
        args,
        exitCode: details.exitCode,
        signal: details.signal,
        stderr: details.stderr,
      });
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    const timeout = setTimeout(() => {
      child.kill();
      logFailure({ exitCode: null, signal: "timeout", stderr });
      finish(
        new Error(
          `Vivliostyle PDF rendering timed out after ${VIVLIOSTYLE_TIMEOUT_MS}ms.`,
        ),
      );
    }, VIVLIOSTYLE_TIMEOUT_MS);

    child.stdout?.on("data", (chunk) => {
      stdout = appendCliOutput(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => {
      logFailure({ exitCode: null, signal: null, stderr });
      finish(error);
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      if (code === 0) {
        finish();
        return;
      }
      logFailure({ exitCode: code, signal, stderr });
      finish(
        new Error(
          [
            `Vivliostyle exited with code ${code ?? "unknown"}${signal ? ` (${signal})` : ""}.`,
            stderr.trim(),
            stdout.trim(),
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    });
  });

export const renderHtmlReportToPdf = async (input: {
  html: string;
  outputPath: string;
}) => {
  const executablePath = resolveChromiumExecutable();
  if (!executablePath) {
    throw new Error(
      "No local Chromium-compatible browser found. Install Chrome/Edge or set MIRA_CHROMIUM_EXECUTABLE_PATH.",
    );
  }

  const vivliostyleCliPath = resolveVivliostyleCliExecutable();
  if (!vivliostyleCliPath) {
    throw new Error(
      "Vivliostyle runtime is unavailable. Run `pnpm prepare:vivliostyle-runtime` or set MIRA_VIVLIOSTYLE_CLI_PATH.",
    );
  }

  fs.mkdirSync(path.dirname(input.outputPath), { recursive: true });
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "mira-vivliostyle-"));
  const htmlPath = path.join(workspace, "report.html");
  const startedAt = Date.now();

  try {
    fs.writeFileSync(htmlPath, prepareHtmlForVivliostyle(input.html), "utf-8");
    await runVivliostyle({
      cliPath: vivliostyleCliPath,
      browserPath: executablePath,
      htmlPath,
      outputPath: input.outputPath,
      cwd: workspace,
    });

    if (!fs.existsSync(input.outputPath) || fs.statSync(input.outputPath).size === 0) {
      throw new Error("Vivliostyle completed without producing a non-empty PDF file.");
    }

    writeStructuredLog("info", {
      scope: "skill-report-pdf",
      event: "html-to-pdf-completed",
      engine: "vivliostyle",
      vivliostyleVersion: VIVLIOSTYLE_RUNTIME_VERSION,
      vivliostyleCliPath,
      executablePath,
      outputPath: input.outputPath,
      durationMs: Date.now() - startedAt,
    });
    return input.outputPath;
  } finally {
    fs.rmSync(workspace, { recursive: true, force: true });
  }
};
