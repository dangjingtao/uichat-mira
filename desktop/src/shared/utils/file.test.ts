import { describe, expect, it } from "vitest";
import { formatFileSize, getFileExtension } from "./file";

describe("formatFileSize", () => {
  it("returns '0 B' for zero bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats megabytes with two decimals", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1024 * 1024 * 1.234)).toBe("1.23 MB");
  });

  it("formats gigabytes", () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
    expect(formatFileSize(1024 * 1024 * 1024 * 1.5)).toBe("1.5 GB");
  });
});

describe("getFileExtension", () => {
  it("returns uppercase extension", () => {
    expect(getFileExtension("document.pdf")).toBe("PDF");
    expect(getFileExtension("archive.tar.gz")).toBe("GZ");
  });

  it("returns 'FILE' when there is no extension", () => {
    expect(getFileExtension("README")).toBe("FILE");
    expect(getFileExtension("")).toBe("FILE");
  });
});
