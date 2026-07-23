import os from "node:os";
import path from "node:path";

export const WENSHU_OFFICE_PACK_ID = "wenshu-office";
export const WENSHU_OFFICE_PACK_VERSION = "1.1.0";

export const resolveRuntimePacksRoot = () => {
  const configured = process.env.MIRA_RUNTIME_PACKS_DIR?.trim();
  if (configured) return path.resolve(configured);

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA?.trim() || process.env.APPDATA?.trim();
    if (localAppData) return path.join(localAppData, "UIChat Mira", "runtime-packs");
  }

  return path.join(os.homedir(), ".local", "share", "uichat-mira", "runtime-packs");
};

export const resolveWenshuOfficePackRoot = () =>
  path.join(resolveRuntimePacksRoot(), WENSHU_OFFICE_PACK_ID, WENSHU_OFFICE_PACK_VERSION);

export const resolveWenshuOfficeSitePackages = () =>
  path.join(resolveWenshuOfficePackRoot(), "site-packages");

export const buildWenshuPythonEnv = (
  sitePackages = resolveWenshuOfficeSitePackages(),
): NodeJS.ProcessEnv => {
  const current = process.env.PYTHONPATH?.trim();
  const entries = (current ?? "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => entry !== sitePackages);
  entries.unshift(sitePackages);
  return {
    ...process.env,
    PYTHONUTF8: "1",
    PYTHONIOENCODING: "utf-8",
    PYTHONPATH: entries.join(path.delimiter),
  };
};
