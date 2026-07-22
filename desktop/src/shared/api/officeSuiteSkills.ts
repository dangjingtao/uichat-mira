import { client, get, post } from "@/shared/lib/request";

const STATUS_ROUTE = "/microapps/office-suite/runtime/status";
const TASK_ROUTE = "/microapps/office-suite/skill-task";
const CATALOG_ROUTE = "/microapps/office-suite/skills/catalog";
const PACK_STATUS_ROUTE = "/microapps/office-suite/capability-pack/status";
const PACK_INSTALL_ROUTE = "/microapps/office-suite/capability-pack/install";

export type WenshuSkillDomain = "pdf" | "xlsx" | "pptx";
export type WenshuSkillPackageId = "docx" | WenshuSkillDomain;

export type WenshuCapabilityPackStatus = {
  id: "wenshu-office";
  version: string;
  installed: boolean;
  installRoot: string;
  sitePackages: string;
  python: string;
  requiredModules: string[];
  missing: string[];
  error?: string;
};

export type WenshuSkillPackageDefinition = {
  id: WenshuSkillPackageId;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  bundled?: boolean;
  runtimePack?: {
    id: "wenshu-office";
    version: string;
    required: true;
  };
  runtimeCapabilities: string[];
  packageFiles: string[];
  contextIntegration: {
    status: "ready";
    mode: "progressive-disclosure";
  };
  statefulRuntime: {
    status: "deferred";
    reason: string;
    requiredContracts: string[];
  };
};

export type WenshuSkillCatalog = {
  skills: WenshuSkillPackageDefinition[];
  pack: WenshuCapabilityPackStatus;
};

export type WenshuRuntimeStatus = {
  runtimes: Array<{
    id: WenshuSkillDomain;
    available: boolean;
    python: string;
    missing: string[];
    error?: string;
  }>;
};

export type WenshuSkillTaskResult =
  | { type: "json"; data: unknown }
  | {
      type: "download";
      fileName: string;
      mimeType: string;
      blob: Blob;
    };

const parseAttachmentFileName = (contentDisposition: unknown) => {
  if (typeof contentDisposition !== "string") return null;
  const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) {
    try { return decodeURIComponent(utf8); } catch { return utf8; }
  }
  return contentDisposition.match(/filename="?([^";]+)"?/i)?.[1]?.trim() || null;
};

export const getWenshuRuntimeStatus = () => get<WenshuRuntimeStatus>(STATUS_ROUTE);

export const getWenshuSkillCatalog = () => get<WenshuSkillCatalog>(CATALOG_ROUTE);

export const getWenshuCapabilityPackStatus = () =>
  get<WenshuCapabilityPackStatus>(PACK_STATUS_ROUTE);

export const installWenshuCapabilityPack = () =>
  post<WenshuCapabilityPackStatus>(PACK_INSTALL_ROUTE, {}, { timeout: 0 });

export const runWenshuSkillTask = async (
  domain: WenshuSkillDomain,
  task: Record<string, unknown>,
  files: File[] = [],
): Promise<WenshuSkillTaskResult> => {
  const formData = new FormData();
  formData.append("task", JSON.stringify(task));
  for (const file of files) formData.append("file", file);

  const response = await client.post<Blob>(`${TASK_ROUTE}?domain=${domain}`, formData, {
    responseType: "blob",
    timeout: 0,
  });
  const mimeType = String(response.headers["content-type"] || response.data.type || "application/octet-stream");
  if (mimeType.includes("application/json")) {
    const text = await response.data.text();
    const payload = JSON.parse(text) as { success?: boolean; data?: unknown; message?: string };
    if (payload.success === false) throw new Error(payload.message || "文枢 Runtime 执行失败");
    return { type: "json", data: payload.data ?? payload };
  }

  return {
    type: "download",
    fileName:
      parseAttachmentFileName(response.headers["content-disposition"]) ||
      `wenshu-${domain}-artifact`,
    mimeType,
    blob: response.data,
  };
};
