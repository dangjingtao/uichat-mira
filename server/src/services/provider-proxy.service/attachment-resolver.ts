import { attachmentStorageService } from "@/services/attachment-storage.service.js";

const toOllamaImage = (value: string) => {
  const dataUrlMatch = value.match(/^data:image\/[^;]+;base64,(.+)$/);
  if (dataUrlMatch?.[1]) {
    return dataUrlMatch[1];
  }

  return value;
};

export const providerAttachmentResolver = {
  async resolveImage(value: string) {
    return attachmentStorageService.isInternalAttachmentUrl(value)
      ? attachmentStorageService.resolveToDataUrl(value)
      : value;
  },

  async resolveImageForOllama(value: string) {
    return toOllamaImage(await this.resolveImage(value));
  },

  async resolveFile(value: string) {
    return attachmentStorageService.isInternalAttachmentUrl(value)
      ? attachmentStorageService.resolveToDataUrl(value)
      : value;
  },
};
