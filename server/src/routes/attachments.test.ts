import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sendRouteError } from "@/utils/route-errors.js";

const mocks = vi.hoisted(() => ({
  getAuthUserFromRequest: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  parseChatFilePart: vi.fn(),
}));

vi.mock("@/db/auth.db.js", () => ({
  getAuthUserFromRequest: mocks.getAuthUserFromRequest,
}));
vi.mock("@/services/attachment-storage.service.js", () => ({
  attachmentStorageService: { save: mocks.save, remove: mocks.remove },
}));
vi.mock("@/services/chat-file-context.service.js", () => ({
  parseChatFilePart: mocks.parseChatFilePart,
}));

import attachmentRoute from "./attachments.js";

const multipartPayload = (fileName: string, mimeType: string, content: string) => {
  const boundary = "----mira-p0-boundary";
  return {
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    payload: [
      `--${boundary}\r\n`,
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
      `Content-Type: ${mimeType}\r\n\r\n`,
      content,
      `\r\n--${boundary}--\r\n`,
    ].join(""),
  };
};

const createApp = async () => {
  const app = Fastify();
  app.setErrorHandler(sendRouteError);
  await app.register(multipart);
  await app.register(attachmentRoute);
  return app;
};

describe("attachment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUserFromRequest.mockReturnValue({ id: 7, username: "alice", role: "user" });
    mocks.save.mockResolvedValue({
      id: "attachment-1",
      url: "/attachments/attachment-1",
      fileName: "stored.txt",
      contentType: "text/plain",
      size: 5,
    });
    mocks.remove.mockResolvedValue(undefined);
    mocks.parseChatFilePart.mockResolvedValue({ text: "hello" });
  });

  it("rejects unauthenticated uploads before reading multipart data", async () => {
    mocks.getAuthUserFromRequest.mockReturnValue(null);
    const app = await createApp();
    const response = await app.inject({ method: "POST", url: "/attachments" });
    expect(response.statusCode).toBe(401);
    expect(mocks.save).not.toHaveBeenCalled();
    await app.close();
  });

  it("rejects unsupported file types without persisting them", async () => {
    const app = await createApp();
    const upload = multipartPayload("payload.exe", "application/octet-stream", "binary");
    const response = await app.inject({ method: "POST", url: "/attachments", ...upload });
    expect(response.statusCode).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    await app.close();
  });

  it("stores supported images without invoking document parsing", async () => {
    mocks.save.mockResolvedValue({
      id: "image-1",
      url: "/attachments/image-1",
      fileName: "stored.png",
      contentType: "image/png",
      size: 3,
    });
    const app = await createApp();
    const upload = multipartPayload("photo.png", "image/png", "png");
    const response = await app.inject({ method: "POST", url: "/attachments", ...upload });
    expect(response.statusCode).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      mimeType: "image/png",
      originalName: "photo.png",
    }));
    expect(mocks.parseChatFilePart).not.toHaveBeenCalled();
    await app.close();
  });

  it("removes a saved document when parsing fails", async () => {
    mocks.parseChatFilePart.mockRejectedValue(new Error("invalid document"));
    const app = await createApp();
    const upload = multipartPayload("notes.txt", "text/plain", "hello");
    const response = await app.inject({ method: "POST", url: "/attachments", ...upload });
    expect(response.statusCode).toBe(400);
    expect(mocks.remove).toHaveBeenCalledWith("stored.txt");
    expect(response.json().message).toContain("invalid document");
    await app.close();
  });
});
