import imageCompression from "browser-image-compression";
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

const toWebpFileName = (fileName: string) =>
  /\.[^.]+$/.test(fileName)
    ? fileName.replace(/\.[^.]+$/, ".webp")
    : `${fileName}.webp`;

const compressChatImageToWebp = async (file: File) => {
  const compressed = await imageCompression(file, {
    fileType: "image/webp",
    initialQuality: 0.86,
    useWebWorker: true,
  });

  return new File([compressed], toWebpFileName(file.name), {
    type: "image/webp",
    lastModified: file.lastModified,
  });
};

export async function uploadChatAttachment(file: File) {
  const uploadFile = file.type.startsWith("image/")
    ? await compressChatImageToWebp(file)
    : file;
  const formData = new FormData();
  formData.append("file", uploadFile, uploadFile.name);

  return post<UploadedAttachment>("/attachments", formData);
}

export function resolveAttachmentUrl(url: string) {
  if (!url.startsWith("/attachments/")) {
    return url;
  }

  return isDesktopShell() ? `${getApiBaseUrl()}${url}` : url;
}
