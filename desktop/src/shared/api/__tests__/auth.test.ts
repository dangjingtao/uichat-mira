import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
}));

import { get, post } from "@/shared/lib/request";
import {
  login,
  getCurrentUser,
  changePassword,
  type LoginResponse,
} from "../auth";

const sampleUser = {
  username: "alice",
  role: "admin" as const,
  displayName: "Alice",
};

const sampleLoginResponse: LoginResponse = {
  token: "token-1",
  tokenType: "Bearer",
  user: sampleUser,
  expiresIn: 3600,
};

describe("auth api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("login 提交凭证并返回登录响应", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleLoginResponse);

    const result = await login({ username: "alice", password: "secret" });

    expect(post).toHaveBeenCalledWith("/login", {
      username: "alice",
      password: "secret",
    });
    expect(result).toBe(sampleLoginResponse);
  });

  it("getCurrentUser 获取当前用户", async () => {
    vi.mocked(get).mockResolvedValueOnce({ user: sampleUser });

    const result = await getCurrentUser();

    expect(get).toHaveBeenCalledWith("/me");
    expect(result).toEqual({ user: sampleUser });
  });

  it("changePassword 提交密码修改", async () => {
    vi.mocked(post).mockResolvedValueOnce({ user: sampleUser });

    const result = await changePassword({
      currentPassword: "old",
      newPassword: "new",
    });

    expect(post).toHaveBeenCalledWith("/account/change-password", {
      currentPassword: "old",
      newPassword: "new",
    });
    expect(result).toEqual({ user: sampleUser });
  });
});
