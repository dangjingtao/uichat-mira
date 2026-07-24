import { describe, expect, it } from "vitest";
import { isValidWorkspaceRootPath } from "./workspace-path-validation.js";

describe("isValidWorkspaceRootPath", () => {
  it("accepts Windows drive paths and roots", () => {
    expect(isValidWorkspaceRootPath("D:\\CODEX_TEST_FOLDER")).toBe(true);
    expect(isValidWorkspaceRootPath("D:\\")).toBe(true);
  });

  it("accepts Windows UNC paths", () => {
    expect(isValidWorkspaceRootPath("\\\\server\\share")).toBe(true);
  });

  it("rejects Unix and relative paths", () => {
    expect(isValidWorkspaceRootPath("/workspace/project-alpha")).toBe(false);
    expect(isValidWorkspaceRootPath("workspace/project-alpha")).toBe(false);
  });
});
