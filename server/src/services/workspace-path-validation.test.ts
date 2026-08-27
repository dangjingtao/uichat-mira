import { describe, expect, it } from "vitest";
import { isValidWorkspaceRootPath } from "./workspace-path-validation.js";

describe("isValidWorkspaceRootPath", () => {
  describe("on Windows", () => {
    it("accepts Windows drive paths and roots", () => {
      expect(
        isValidWorkspaceRootPath("D:\\CODEX_TEST_FOLDER", "win32"),
      ).toBe(true);
      expect(isValidWorkspaceRootPath("D:\\", "win32")).toBe(true);
    });

    it("accepts Windows UNC paths", () => {
      expect(
        isValidWorkspaceRootPath("\\\\server\\share", "win32"),
      ).toBe(true);
    });

    it("rejects POSIX and relative paths", () => {
      expect(
        isValidWorkspaceRootPath("/workspace/project-alpha", "win32"),
      ).toBe(false);
      expect(
        isValidWorkspaceRootPath("workspace/project-alpha", "win32"),
      ).toBe(false);
    });
  });

  describe("on macOS", () => {
    it("accepts POSIX roots and absolute paths", () => {
      expect(isValidWorkspaceRootPath("/", "darwin")).toBe(true);
      expect(
        isValidWorkspaceRootPath(
          "/Users/tao/Documents/UIChat Mira/中文工作区",
          "darwin",
        ),
      ).toBe(true);
    });

    it("rejects Windows and relative paths", () => {
      expect(
        isValidWorkspaceRootPath("D:\\CODEX_TEST_FOLDER", "darwin"),
      ).toBe(false);
      expect(
        isValidWorkspaceRootPath("\\\\server\\share", "darwin"),
      ).toBe(false);
      expect(
        isValidWorkspaceRootPath("workspace/project-alpha", "darwin"),
      ).toBe(false);
    });
  });
});
