import { client, get } from "@/shared/lib/request";

const STATUS_ROUTE = "/microapps/office-suite/runtime/status";
const TASK_ROUTE = "/microapps/office-suite/skill-task";

export type WenshuSkillDomain = "pdf" | "xlsx" | "pptx";

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
    if (payload.success === false) throw new Error(payload.message || "文枢 Skill Runtime 执行失败");
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
