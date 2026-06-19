import { post } from "../lib/request";
import {
  getApiBaseUrl,
  isDesktopShell,
} from "@/shared/platform/desktopRuntime";

export type UploadedAttachment = {
  id: string;
  fileName: string;
  url: string;
  contentType: string;
  size: number;
};

export async function uploadChatAttachment(file: File) {
  const formData = new FormData();
  formData.append("file", file, file.name);

  return post<UploadedAttachment>("/attachments", formData);
}

export function resolveAttachmentUrl(url: string) {
  if (!url.startsWith("/attachments/")) {
    return url;
  }

  return isDesktopShell() ? `${getApiBaseUrl()}${url}` : url;
}
