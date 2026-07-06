// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockClient),
    isAxiosError: vi.fn((error) => Boolean(error?.isAxiosError)),
  },
  __esModule: true,
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: vi.fn(() => "http://localhost:3000"),
  isDesktopShell: vi.fn(() => false),
}));

vi.mock("@/shared/lib/sessionStorage", () => ({
  getSession: vi.fn(() => null),
  clearSessionFromStorage: vi.fn(),
}));

import axios from "axios";
import {
  getApiBaseUrl,
  isDesktopShell,
} from "@/shared/platform/desktopRuntime";
import {
  getSession,
  clearSessionFromStorage,
} from "@/shared/lib/sessionStorage";
import {
  get,
  post,
  put,
  patch,
  del,
  client,
  ApiError,
  ErrorCodes,
} from "../request";

const requestInterceptor = (
  mockClient.interceptors.request.use as ReturnType<typeof vi.fn>
).mock.calls[0][0];
const responseErrorHandler = (
  mockClient.interceptors.response.use as ReturnType<typeof vi.fn>
).mock.calls[0][1];

describe("request", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.mocked(getSession).mockReturnValue(null);
    vi.mocked(isDesktopShell).mockReturnValue(false);
    mockClient.get.mockReset();
    mockClient.post.mockReset();
    mockClient.put.mockReset();
    mockClient.patch.mockReset();
    mockClient.delete.mockReset();

    const locationMock = { href: "http://localhost/", hash: "" };
    vi.stubGlobal("window", { ...window, location: locationMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("使用 desktopRuntime 提供的 baseURL 创建 axios 客户端", () => {
    expect(vi.mocked(axios.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "http://localhost:3000",
        timeout: 30000,
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(vi.mocked(getApiBaseUrl)).toHaveBeenCalled();
  });

  describe("请求拦截器", () => {
    it("存在会话时附加 Bearer token", () => {
      vi.mocked(getSession).mockReturnValue({
        token: "token-1",
        user: { username: "alice", role: "admin" },
      });
      const config = { headers: {} };
      const result = requestInterceptor(config);
      expect(result.headers.Authorization).toBe("Bearer token-1");
    });

    it("无会话时不附加 Authorization", () => {
      const config = { headers: {} };
      const result = requestInterceptor(config);
      expect(result.headers.Authorization).toBeUndefined();
    });

    it("FormData 请求移除 Content-Type 头", () => {
      const formData = new FormData();
      const config = {
        headers: { "Content-Type": "application/json" },
        data: formData,
      };
      const result = requestInterceptor(config);
      expect(result.headers["Content-Type"]).toBeUndefined();
    });
  });

  describe("HTTP 方法", () => {
    it("get 返回成功响应的 data", async () => {
      vi.mocked(client.get).mockResolvedValueOnce({
        data: { success: true, data: { id: 1 } },
      });
      const result = await get("/items");
      expect(client.get).toHaveBeenCalledWith("/items", undefined);
      expect(result).toEqual({ id: 1 });
    });

    it("post 发送数据并返回 data", async () => {
      vi.mocked(client.post).mockResolvedValueOnce({
        data: { success: true, data: { id: 2 } },
      });
      const result = await post("/items", { name: "x" });
      expect(client.post).toHaveBeenCalledWith(
        "/items",
        { name: "x" },
        undefined,
      );
      expect(result).toEqual({ id: 2 });
    });

    it("put 发送数据并返回 data", async () => {
      vi.mocked(client.put).mockResolvedValueOnce({
        data: { success: true, data: { id: 3 } },
      });
      const result = await put("/items/1", { name: "y" });
      expect(client.put).toHaveBeenCalledWith(
        "/items/1",
        { name: "y" },
        undefined,
      );
      expect(result).toEqual({ id: 3 });
    });

    it("patch 发送数据并返回 data", async () => {
      vi.mocked(client.patch).mockResolvedValueOnce({
        data: { success: true, data: { id: 4 } },
      });
      const result = await patch("/items/1", { name: "z" });
      expect(client.patch).toHaveBeenCalledWith(
        "/items/1",
        { name: "z" },
        undefined,
      );
      expect(result).toEqual({ id: 4 });
    });

    it("delete 返回 data", async () => {
      vi.mocked(client.delete).mockResolvedValueOnce({
        data: { success: true, data: { deleted: true } },
      });
      const result = await del("/items/1");
      expect(client.delete).toHaveBeenCalledWith("/items/1", undefined);
      expect(result).toEqual({ deleted: true });
    });
  });

  describe("响应错误处理", () => {
    it("业务失败响应抛出 ApiError", async () => {
      vi.mocked(client.get).mockResolvedValueOnce({
        data: {
          success: false,
          message: "not found",
          code: ErrorCodes.NOT_FOUND,
          timestamp: "t1",
        },
      });
      await expect(get("/items")).rejects.toSatisfy((error) => {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe("not found");
        return true;
      });
    });

    it("axios 错误转换为 ApiError", async () => {
      vi.mocked(client.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            message: "server error",
            code: ErrorCodes.INTERNAL_ERROR,
            timestamp: "t2",
          },
        },
      });
      await expect(get("/items")).rejects.toSatisfy((error) => {
        expect(error).toBeInstanceOf(ApiError);
        expect(error.message).toBe("server error");
        return true;
      });
    });

    it("UNAUTHORIZED 时清除会话并跳转浏览器登录页", async () => {
      vi.mocked(client.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            message: "unauthorized",
            code: ErrorCodes.UNAUTHORIZED,
            timestamp: "t3",
          },
        },
      });
      await expect(get("/items")).rejects.toThrow(ApiError);
      expect(clearSessionFromStorage).toHaveBeenCalled();
      expect(window.location.href).toBe("/login");
    });

    it("桌面端 UNAUTHORIZED 时跳转到 #/login", async () => {
      vi.mocked(isDesktopShell).mockReturnValue(true);
      vi.mocked(client.get).mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          data: {
            success: false,
            message: "unauthorized",
            code: ErrorCodes.UNAUTHORIZED,
            timestamp: "t4",
          },
        },
      });
      await expect(get("/items")).rejects.toThrow(ApiError);
      expect(clearSessionFromStorage).toHaveBeenCalled();
      expect(window.location.hash).toBe("#/login");
    });
  });

  describe("ApiError", () => {
    it("携带 code、errors 与 timestamp", () => {
      const error = new ApiError({
        success: false,
        message: "bad request",
        code: ErrorCodes.VALIDATION_ERROR,
        errors: [{ field: "name" }],
        timestamp: "ts",
      });
      expect(error.message).toBe("bad request");
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.errors).toEqual([{ field: "name" }]);
      expect(error.timestamp).toBe("ts");
      expect(error.name).toBe("ApiError");
    });
  });
});
