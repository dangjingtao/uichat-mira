// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "./clipboard";

describe("copyTextToClipboard", () => {
  const originalExecCommand = (document as Document & { execCommand?: () => boolean })
    .execCommand;

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    (document as Document & { execCommand?: () => boolean }).execCommand =
      originalExecCommand;
  });

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const result = await copyTextToClipboard("hello");

    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("falls back to textarea when navigator.clipboard is unavailable", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as Document & { execCommand?: () => boolean }).execCommand =
      execCommand;

    const result = await copyTextToClipboard("fallback");

    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("falls back when navigator.clipboard.writeText throws", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as Document & { execCommand?: () => boolean }).execCommand =
      execCommand;

    const result = await copyTextToClipboard("error");

    expect(result).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("returns false when fallback execCommand returns false", async () => {
    vi.stubGlobal("navigator", { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(false);
    (document as Document & { execCommand?: () => boolean }).execCommand =
      execCommand;

    const result = await copyTextToClipboard("fail");

    expect(result).toBe(false);
  });
});
