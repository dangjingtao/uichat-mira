import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveGithubMirrorUrl } from "../github";

describe("github", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("github.com 链接转换为默认镜像", () => {
    const result = resolveGithubMirrorUrl("https://github.com/org/repo");
    expect(result).toBe("https://github.com.cnpmjs.org/org/repo");
  });

  it("保留 search 与 hash", () => {
    const result = resolveGithubMirrorUrl(
      "https://github.com/org/repo?tab=readme#section",
    );
    expect(result).toBe(
      "https://github.com.cnpmjs.org/org/repo?tab=readme#section",
    );
  });

  it("非 github.com 域名原样返回", () => {
    expect(resolveGithubMirrorUrl("https://gitlab.com/org/repo")).toBe(
      "https://gitlab.com/org/repo",
    );
  });

  it("空字符串原样返回", () => {
    expect(resolveGithubMirrorUrl("")).toBe("");
  });

  it("仅空白字符串原样返回", () => {
    expect(resolveGithubMirrorUrl("   ")).toBe("");
  });

  it("非法 URL 原样返回", () => {
    expect(resolveGithubMirrorUrl("not a url")).toBe("not a url");
  });

  it("支持环境变量切换镜像地址", () => {
    vi.stubEnv("VITE_GITHUB_MIRROR_BASE", "https://mirror.example.com/");

    const result = resolveGithubMirrorUrl("https://github.com/org/repo");
    expect(result).toBe("https://mirror.example.com/org/repo");
  });

  it("无路径时返回镜像根地址", () => {
    const result = resolveGithubMirrorUrl("https://github.com/");
    expect(result).toBe("https://github.com.cnpmjs.org");
  });
});
