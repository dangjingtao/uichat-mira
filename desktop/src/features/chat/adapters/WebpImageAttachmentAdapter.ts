import imageCompression from "browser-image-compression";
import type {
  Attachment,
  AttachmentAdapter,
  CompleteAttachment,
  PendingAttachment,
} from "@assistant-ui/react";
import { uploadChatAttachment } from "@/shared/api/attachments";

const MAX_IMAGE_SIDE = 2048;
const WEBP_MIME_TYPE = "image/webp";

const toWebpName = (name: string) => {
  const baseName = name.replace(/\.[^.]+$/, "").trim() || "image";
  return `${baseName}.webp`;
};

export class WebpImageAttachmentAdapter implements AttachmentAdapter {
  public accept = "image/*";

  public async add(state: { file: File }): Promise<PendingAttachment> {
    return {
      id: `${state.file.name}-${state.file.lastModified}`,
      type: "image",
      name: toWebpName(state.file.name),
      contentType: WEBP_MIME_TYPE,
      file: state.file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  public async send(
    attachment: PendingAttachment,
  ): Promise<CompleteAttachment> {
    const compressed = await imageCompression(attachment.file, {
      fileType: WEBP_MIME_TYPE,
      initialQuality: 0.86,
      maxWidthOrHeight: MAX_IMAGE_SIDE,
      useWebWorker: true,
    });
    const file =
      compressed instanceof File
        ? compressed
        : new File([compressed], attachment.name, { type: WEBP_MIME_TYPE });
    const webpFile = new File([file], attachment.name, {
      type: WEBP_MIME_TYPE,
      lastModified: file.lastModified,
    });
    const uploaded = await uploadChatAttachment(webpFile);

    return {
      ...attachment,
      name: attachment.name,
      contentType: WEBP_MIME_TYPE,
      file: webpFile,
      status: { type: "complete" },
      content: [
        {
          type: "image",
          image: uploaded.url,
          filename: attachment.name,
        },
      ],
    };
  }

  public async remove(_attachment: Attachment) {
    // Local in-memory attachments do not need explicit cleanup.
  }
}
