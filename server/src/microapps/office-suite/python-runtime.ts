import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

type PythonJsonResult = {
  status: string;
  data?: unknown;
  error?: string;
  message?: string;
  [key: string]: unknown;
};

const PYTHON_ENV_KEYS = [
  "MIRA_SYSTEM_DEVKIT_PYTHON",
  "MIRA_DEVKIT_PYTHON",
  "UI_CHAT_DEVKIT_PYTHON",
  "UI_CHAT_PYTHON_BIN",
] as const;

const resolveConfiguredPython = () => {
  for (const key of PYTHON_ENV_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
};

/**
 * WenShu never bundles another Python runtime. It resolves the Python supplied
 * by Mira's system development kit first and only falls back to PATH for dev.
 */
export const resolveSystemDevelopmentPython = () =>
  resolveConfiguredPython() ?? (process.platform === "win32" ? "python" : "python3");

const toolRootCandidates = () => {
  const configured = process.env.MIRA_WENSHU_TOOLS_ROOT?.trim();
  const entryDir = process.argv[1] ? path.dirname(path.resolve(process.argv[1])) : null;
  return [
    configured || null,
    entryDir ? path.join(entryDir, "tools", "wenshu") : null,
    path.join(process.cwd(), "tools", "wenshu"),
    path.join(process.cwd(), "server", "tools", "wenshu"),
  ].filter((value): value is string => Boolean(value));
};

export const resolveWenshuToolPath = (relativePath: string) => {
  for (const root of toolRootCandidates()) {
    const candidate = path.join(root, relativePath);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `WenShu Python tool not found: ${relativePath}. Checked: ${toolRootCandidates().join(", ")}`,
  );
};

const tryParseJson = (value: string): PythonJsonResult | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as PythonJsonResult;
    return parsed && typeof parsed === "object" && typeof parsed.status === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
};

const parseJsonResult = (stdout: string, stderr: string): PythonJsonResult => {
  for (const stream of [stdout, stderr]) {
    const whole = tryParseJson(stream);
    if (whole) return whole;
  }

  for (const stream of [stdout, stderr]) {
    const lines = stream.trim().split(/\r?\n/).reverse().filter(Boolean);
    for (const line of lines) {
      const parsed = tryParseJson(line);
      if (parsed) return parsed;
    }
  }

  for (const stream of [stdout, stderr]) {
    const starts = [...stream.matchAll(/\{/g)]
      .map((match) => match.index ?? -1)
      .reverse();
    for (const start of starts) {
      if (start < 0) continue;
      const parsed = tryParseJson(stream.slice(start));
      if (parsed) return parsed;
    }
  }

  throw new Error(
    `WenShu Python runtime returned no JSON result.${
      stderr.trim() ? ` stderr: ${stderr.trim().slice(-2000)}` : ""
    }`,
  );
};

export const runWenshuPython = async (input: {
  script: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}) => {
  const python = resolveSystemDevelopmentPython();
  const script = resolveWenshuToolPath(input.script);
  const timeoutMs = input.timeoutMs ?? 120_000;

  return await new Promise<{
    python: string;
    script: string;
    stdout: string;
    stderr: string;
    result: PythonJsonResult;
  }>((resolve, reject) => {
    const child = spawn(python, [script, ...input.args], {
      cwd: input.cwd,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const timer = setTimeout(() => {
      child.kill();
      rejectOnce(new Error(`WenShu Python runtime timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (stdout.length > 64 * 1024 * 1024) {
        child.kill();
        rejectOnce(new Error("WenShu Python stdout exceeded 64 MiB"));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      if (stderr.length > 64 * 1024 * 1024) {
        child.kill();
        rejectOnce(new Error("WenShu Python stderr exceeded 64 MiB"));
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectOnce(
        new Error(
          `Failed to start system development-kit Python (${python}): ${error.message}`,
          { cause: error },
        ),
      );
    });
    child.on("close", (code) => {
      if (settled) return;
      clearTimeout(timer);
      try {
        const result = parseJsonResult(stdout, stderr);
        const successStatuses = new Set(["success", "pass"]);
        if (code !== 0 || !successStatuses.has(result.status)) {
          rejectOnce(
            new Error(
              result.message ||
                `WenShu Python runtime failed with exit code ${code ?? "unknown"}`,
            ),
          );
          return;
        }
        settled = true;
        resolve({ python, script, stdout, stderr, result });
      } catch (error) {
        rejectOnce(error instanceof Error ? error : new Error(String(error)));
      }
    });
  });
};

export const withWenshuTempDir = async <T>(
  prefix: string,
  run: (dir: string) => Promise<T>,
) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `mira-wenshu-${prefix}-`));
  try {
    return await run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

export const writeJsonFile = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
};

export const probeWenshuPythonRuntime = async () => {
  const python = resolveSystemDevelopmentPython();
  const checks = [
    {
      id: "pdf",
      modules: [
        "reportlab",
        "matplotlib",
        "pdfplumber",
        "pikepdf",
        "markdown2",
        "xhtml2pdf",
      ],
    },
    { id: "xlsx", modules: ["openpyxl"] },
    { id: "pptx", modules: ["pptx", "PIL"] },
  ] as const;

  return await Promise.all(
    checks.map(
      (check) =>
        new Promise<{
          id: string;
          available: boolean;
          python: string;
          missing: string[];
          error?: string;
        }>((resolve) => {
          const code = [
            "import importlib.util, json",
            `mods=${JSON.stringify(check.modules)}`,
            "missing=[m for m in mods if importlib.util.find_spec(m) is None]",
            "print(json.dumps({'missing':missing}))",
          ].join("\n");
          const child = spawn(python, ["-c", code], {
            windowsHide: true,
            env: {
              ...process.env,
              PYTHONUTF8: "1",
              PYTHONIOENCODING: "utf-8",
            },
            stdio: ["ignore", "pipe", "pipe"],
          });
          let stdout = "";
          let stderr = "";
          let resolved = false;
          const done = (value: {
            id: string;
            available: boolean;
            python: string;
            missing: string[];
            error?: string;
          }) => {
            if (resolved) return;
            resolved = true;
            resolve(value);
          };
          child.stdout.setEncoding("utf8");
          child.stderr.setEncoding("utf8");
          child.stdout.on("data", (chunk) => (stdout += chunk));
          child.stderr.on("data", (chunk) => (stderr += chunk));
          child.on("error", (error) =>
            done({
              id: check.id,
              available: false,
              python,
              missing: [...check.modules],
              error: error.message,
            }),
          );
          child.on("close", (codeValue) => {
            try {
              const parsed = JSON.parse(stdout.trim()) as { missing?: string[] };
              const missing = Array.isArray(parsed.missing)
                ? parsed.missing
                : [...check.modules];
              done({
                id: check.id,
                available: codeValue === 0 && missing.length === 0,
                python,
                missing,
                ...(stderr.trim() ? { error: stderr.trim().slice(-1000) } : {}),
              });
            } catch {
              done({
                id: check.id,
                available: false,
                python,
                missing: [...check.modules],
                error: stderr.trim() || stdout.trim() || `Python exited ${codeValue}`,
              });
            }
          });
        }),
    ),
  );
};
