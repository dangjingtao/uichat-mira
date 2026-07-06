import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));

import { get, post, patch, del } from "@/shared/lib/request";
import {
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  type RoleSummary,
  type RoleMutationPayload,
} from "../roles";

const sampleRole: RoleSummary = {
  id: "role-1",
  name: "助手",
  summary: "通用助手",
  avatarId: null,
  status: "active",
  tags: [],
  createdAt: "2026-07-06T00:00:00.000Z",
  updatedAt: "2026-07-06T00:00:00.000Z",
};

describe("roles api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listRoles 支持查询参数", async () => {
    vi.mocked(get).mockResolvedValueOnce([sampleRole]);

    const result = await listRoles({
      status: "active",
      sortBy: "name",
      sortOrder: "asc",
    });

    expect(get).toHaveBeenCalledWith("/roles", {
      params: { status: "active", sortBy: "name", sortOrder: "asc" },
    });
    expect(result).toEqual([sampleRole]);
  });

  it("getRoleById 获取角色详情", async () => {
    vi.mocked(get).mockResolvedValueOnce(sampleRole);

    const result = await getRoleById("role-1");

    expect(get).toHaveBeenCalledWith("/roles/role-1");
    expect(result).toBe(sampleRole);
  });

  it("createRole 创建角色", async () => {
    vi.mocked(post).mockResolvedValueOnce(sampleRole);

    const payload: RoleMutationPayload = { name: "新角色" };
    const result = await createRole(payload);

    expect(post).toHaveBeenCalledWith("/roles", payload);
    expect(result).toBe(sampleRole);
  });

  it("updateRole 更新角色", async () => {
    vi.mocked(patch).mockResolvedValueOnce(sampleRole);

    const payload: RoleMutationPayload = { name: "已更新" };
    const result = await updateRole("role-1", payload);

    expect(patch).toHaveBeenCalledWith("/roles/role-1", payload);
    expect(result).toBe(sampleRole);
  });

  it("deleteRole 删除角色", async () => {
    vi.mocked(del).mockResolvedValueOnce({ deleted: true });

    const result = await deleteRole("role-1");

    expect(del).toHaveBeenCalledWith("/roles/role-1");
    expect(result).toEqual({ deleted: true });
  });
});
