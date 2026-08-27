import { describe, expect, it } from "vitest";
import { isValidWorkspaceRootPath } from "./runtimePolicies";

describe("isValidWorkspaceRootPath", () => {
  describe("on Windows", () => {
    it("accepts Windows absolute paths", () => {
      expect(isValidWorkspaceRootPath("D:\\testData", "win32")).toBe(true);
    });

    it("accepts Windows drive roots", () => {
      expect(isValidWorkspaceRootPath("D:\\", "win32")).toBe(true);
    });

    it("accepts UNC paths", () => {
      expect(isValidWorkspaceRootPath("\\\\server\\share", "win32")).toBe(true);
    });

    it("rejects POSIX absolute paths", () => {
      expect(isValidWorkspaceRootPath("/workspace/rag-demo", "win32")).toBe(
        false,
      );
      expect(isValidWorkspaceRootPath("/", "win32")).toBe(false);
    });

    it("rejects relative paths", () => {
      expect(isValidWorkspaceRootPath("testData", "win32")).toBe(false);
    });
  });

  describe("on macOS", () => {
    it("accepts POSIX absolute paths and root", () => {
      expect(
        isValidWorkspaceRootPath("/Users/tao/Workspace", "darwin"),
      ).toBe(true);
      expect(isValidWorkspaceRootPath("/", "darwin")).toBe(true);
    });

    it("accepts absolute paths with spaces and Chinese characters", () => {
      expect(
        isValidWorkspaceRootPath(
          "/Users/tao/Documents/UIChat Mira/中文工作区",
          "darwin",
        ),
      ).toBe(true);
    });

    it("rejects Windows paths", () => {
      expect(isValidWorkspaceRootPath("D:\\testData", "darwin")).toBe(false);
      expect(isValidWorkspaceRootPath("\\\\server\\share", "darwin")).toBe(
        false,
      );
    });

    it("rejects relative paths", () => {
      expect(isValidWorkspaceRootPath("Workspace/project", "darwin")).toBe(
        false,
      );
    });
  });
});
