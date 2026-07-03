import { afterEach, describe, expect, it, vi } from "vitest";
import { roleService } from "@/services/role.service.js";
import { resolveRoleContext } from "./thread-request-context-role.resolver.js";

describe("resolveRoleContext", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when roleId is missing", () => {
    expect(
      resolveRoleContext({
        thread: {
          roleId: null,
          contextSummary: null,
        },
        userId: 1,
      }),
    ).toBeNull();
  });

  it("returns null when the bound role cannot be found", () => {
    vi.spyOn(roleService, "getRoleById").mockReturnValue(null);

    expect(
      resolveRoleContext({
        thread: {
          roleId: "missing-role",
          contextSummary: null,
        },
        userId: 1,
      }),
    ).toBeNull();
  });

  it("builds one canonical system prompt from role prompt fragments", () => {
    vi.spyOn(roleService, "getRoleById").mockReturnValue({
      id: "role-1",
      name: "Programmer",
      summary: "Writes and verifies code carefully",
      avatarId: "pilot-helper",
      status: "active",
      tags: ["code"],
      prompt: {
        description: "你是一个程序员人设。",
        worldview: "遇到可验证问题优先验证。",
        persona: "直接、克制、基于事实。",
        scenario: "",
        exampleDialogues: "",
        style: "简洁",
        constraints: "不要假装运行过代码。",
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const context = resolveRoleContext({
      thread: {
        roleId: "role-1",
        contextSummary: null,
        contextSummaryUpdatedAt: null,
      },
      userId: 1,
    });

    expect(context?.message).toEqual({
      role: "system",
      content: expect.stringContaining("角色名：Programmer"),
    });
    expect(context?.message?.content).toContain("不要假装运行过代码。");
    expect(context?.executionNode).toEqual({
      nodeId: "request-context-role-role-1",
      nodeType: "memory",
      phase: "done",
      label: "角色记忆",
      summary: "已加载线程绑定角色设定",
      details: {
        roleId: "role-1",
      },
    });
  });
});
