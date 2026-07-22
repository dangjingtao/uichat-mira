import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  resolveSystemDevelopmentPython,
  resolveWenshuToolPath,
} from "./python-runtime.js";
import {
  buildWenshuPythonEnv,
  resolveWenshuOfficePackRoot,
  resolveWenshuOfficeSitePackages,
  WENSHU_OFFICE_PACK_ID,
  WENSHU_OFFICE_PACK_VERSION,
} from "./runtime-pack-paths.js";

const REQUIRED_MODULES = [
  "reportlab",
  "matplotlib",
  "pdfplumber",
  "pikepdf",
  "markdown2",
  "xhtml2pdf",
  "openpyxl",
  "pptx",
  "PIL",
] as const;

const MANIFEST_FILE = "manifest.json";
let installation: Promise<WenshuCapabilityPackStatus> | null = null;

export type WenshuCapabilityPackStatus = {
  id: typeof WENSHU_OFFICE_PACK_ID;
  version: typeof WENSHU_OFFICE_PACK_VERSION;
  installed: boolean;
  installRoot: string;
  sitePackages: string;
  python: string;
  requiredModules: string[];
  missing: string[];
  error?: string;
};

const probeModules = async (sitePackages: string) => {
  const python = resolveSystemDevelopmentPython();
  const code = [
    "import importlib.util, json",
    `mods=${JSON.stringify(REQUIRED_MODULES)}`,
    "missing=[m for m in mods if importlib.util.find_spec(m) is None]",
    "print(json.dumps({'missing': missing}))",
  ].join("\n");

  return await new Promise<{ missing: string[]; error?: string }>((resolve) => {
    const child = spawn(python, ["-c", code], {
      windowsHide: true,
      env: buildWenshuPythonEnv(sitePackages),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const done = (value: { missing: string[]; error?: string }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => done({ missing: [...REQUIRED_MODULES], error: error.message }));
    child.on("close", (codeValue) => {
      try {
        const parsed = JSON.parse(stdout.trim()) as { missing?: string[] };
        const missing = Array.isArray(parsed.missing) ? parsed.missing : [...REQUIRED_MODULES];
        done({
          missing,
          ...(codeValue !== 0 || stderr.trim()
            ? { error: stderr.trim().slice(-2000) || `Python exited ${codeValue}` }
            : {}),
        });
      } catch {
        done({
          missing: [...REQUIRED_MODULES],
          error: stderr.trim().slice(-2000) || stdout.trim().slice(-2000) || `Python exited ${codeValue}`,
        });
      }
    });
  });
};

export const getWenshuCapabilityPackStatus = async (): Promise<WenshuCapabilityPackStatus> => {
  const installRoot = resolveWenshuOfficePackRoot();
  const sitePackages = resolveWenshuOfficeSitePackages();
  const python = resolveSystemDevelopmentPython();
  const manifestPath = path.join(installRoot, MANIFEST_FILE);
  const hasManifest = fs.existsSync(manifestPath);
  const probe = await probeModules(sitePackages);
  return {
    id: WENSHU_OFFICE_PACK_ID,
    version: WENSHU_OFFICE_PACK_VERSION,
    installed: hasManifest && probe.missing.length === 0,
    installRoot,
    sitePackages,
    python,
    requiredModules: [...REQUIRED_MODULES],
    missing: probe.missing,
    ...(probe.error ? { error: probe.error } : {}),
  };
};

const runPipInstall = async (stagingSitePackages: string) => {
  const python = resolveSystemDevelopmentPython();
  const requirements = resolveWenshuToolPath("requirements.txt");
  fs.mkdirSync(stagingSitePackages, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      python,
      [
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--no-input",
        "--upgrade",
        "--target",
        stagingSitePackages,
        "-r",
        requirements,
      ],
      {
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONUTF8: "1",
          PYTHONIOENCODING: "utf-8",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    const MAX_LOG = 4 * 1024 * 1024;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("WenShu capability pack installation timed out after 20 minutes"));
    }, 20 * 60 * 1000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout = `${stdout}${chunk}`.slice(-MAX_LOG);
    });
    child.stderr.on("data", (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-MAX_LOG);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(new Error(`Failed to start pip with ${python}: ${error.message}`, { cause: error }));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `WenShu capability pack installation failed (exit ${code ?? "unknown"}). ${stderr.trim() || stdout.trim()}`,
        ),
      );
    });
  });
};

const performInstall = async (): Promise<WenshuCapabilityPackStatus> => {
  const targetRoot = resolveWenshuOfficePackRoot();
  const parent = path.dirname(targetRoot);
  const stagingRoot = `${targetRoot}.installing-${process.pid}-${Date.now()}`;
  const stagingSitePackages = path.join(stagingRoot, "site-packages");
  fs.mkdirSync(parent, { recursive: true });
  fs.rmSync(stagingRoot, { recursive: true, force: true });

  try {
    await runPipInstall(stagingSitePackages);
    const probe = await probeModules(stagingSitePackages);
    if (probe.missing.length > 0) {
      throw new Error(`Installed WenShu pack is incomplete. Missing: ${probe.missing.join(", ")}`);
    }

    fs.writeFileSync(
      path.join(stagingRoot, MANIFEST_FILE),
      JSON.stringify(
        {
          id: WENSHU_OFFICE_PACK_ID,
          version: WENSHU_OFFICE_PACK_VERSION,
          installedAt: new Date().toISOString(),
          python: resolveSystemDevelopmentPython(),
          modules: [...REQUIRED_MODULES],
        },
        null,
        2,
      ),
      "utf8",
    );

    fs.rmSync(targetRoot, { recursive: true, force: true });
    fs.renameSync(stagingRoot, targetRoot);
    return await getWenshuCapabilityPackStatus();
  } catch (error) {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    throw error;
  }
};

export const installWenshuCapabilityPack = async () => {
  if (!installation) {
    installation = performInstall().finally(() => {
      installation = null;
    });
  }
  return await installation;
};
