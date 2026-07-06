import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("browser-image-compression", () => ({
  default: vi.fn((file: File) =>
    Promise.resolve(
      new File(["compressed"], file.name.replace(/\.[^.]+$/, ".webp"), {
        type: "image/webp",
      }),
    ),
  ),
}));

vi.mock("@/shared/lib/request", () => ({
  post: vi.fn(),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  isDesktopShell: vi.fn(() => false),
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
}));

import { post } from "@/shared/lib/request";
import { isDesktopShell, getApiBaseUrl } from "@/shared/platform/desktopRuntime";
import {
  uploadChatAttachment,
  resolveAttachmentUrl,
  type UploadedAttachment,
} from "../attachments";

const sampleAttachment: UploadedAttachment = {
  id: "att-1",
  fileName: "doc.webp",
  url: "/attachments/att-1",
  contentType: "image/webp",
  size: 100,
};

describe("attachments api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDesktopShell).mockReturnValue(false);
  });

  it("uploadChatAttachment 对图片进行 webp 压缩后上传", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleAttachment);

    const file = new File(["image"], "photo.png", { type: "image/png" });
    const result = await uploadChatAttachment(file);

    expect(post).toHaveBeenCalledWith(
      "/attachments",
      expect.any(FormData),
    );
    const formData = vi.mocked(post).mock.calls[0][1] as FormData;
    expect(formData.get("file") instanceof File).toBe(true);
    expect((formData.get("file") as File).name).toBe("photo.webp");
    expect(result).toBe(sampleAttachment);
  });

  it("uploadChatAttachment 非图片直接上传", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleAttachment);

    const file = new File(["text"], "doc.txt", { type: "text/plain" });
    const result = await uploadChatAttachment(file);

    const formData = vi.mocked(post).mock.calls[0][1] as FormData;
    expect((formData.get("file") as File).name).toBe("doc.txt");
    expect(result).toBe(sampleAttachment);
  });

  it("resolveAttachmentUrl 非附件路径原样返回", () => {
    expect(resolveAttachmentUrl("https://example.com/file")).toBe(
      "https://example.com/file",
    );
  });

  it("resolveAttachmentUrl 桌面端补全 baseUrl", () => {
    vi.mocked(isDesktopShell).mockReturnValue(true);

    expect(resolveAttachmentUrl("/attachments/att-1")).toBe(
      "http://localhost:3000/attachments/att-1",
    );
  });

  it("resolveAttachmentUrl 非桌面端保留相对路径", () => {
    expect(resolveAttachmentUrl("/attachments/att-1")).toBe(
      "/attachments/att-1",
    );
  });
});
