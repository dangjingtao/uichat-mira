import { afterEach, describe, expect, it, vi } from "vitest";
import { roleService } from "@/services/role.service.js";
import { threadRequestContextNode } from "./thread-request-context.node.js";

describe("threadRequestContextNode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns no request messages when neither role nor summary is present", () => {
    expect(
      threadRequestContextNode.createRequestContext(
        {
          roleId: null,
          contextSummary: null,
          contextSummaryUpdatedAt: null,
          agentEnabled: false,
        },
        1,
      ),
    ).toEqual({
      messages: [],
      executionNodes: [],
    });
  });

  it("resolves role context into the first system message", () => {
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

    const context = threadRequestContextNode.createRequestContext(
      {
        roleId: "role-1",
        contextSummary: null,
        contextSummaryUpdatedAt: null,
        agentEnabled: false,
      },
      1,
    );

    expect(context.messages).toHaveLength(1);
    expect(context.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining("角色名：Programmer"),
    });
    expect(context.messages[0]?.content).toContain("不要假装运行过代码。");
  });

  it("resolves summary context into a system message", () => {
    const context = threadRequestContextNode.createRequestContext(
      {
        roleId: null,
        contextSummary: "用户偏好简洁回答，并保持当前调试上下文。",
        contextSummaryUpdatedAt: "2026-06-26T00:00:00.000Z",
        agentEnabled: false,
      },
      1,
    );

    expect(context.messages).toHaveLength(1);
    expect(context.messages[0]).toEqual({
      role: "system",
      content: expect.stringContaining("线程摘要"),
    });
    expect(context.messages[0]?.content).toContain("用户偏好简洁回答");
  });

  it("keeps resolver order stable: role first, summary second", () => {
    vi.spyOn(roleService, "getRoleById").mockReturnValue({
      id: "role-1",
      name: "Programmer",
      summary: "",
      avatarId: null,
      status: "active",
      tags: [],
      prompt: {
        description: "你是一个程序员人设。",
        worldview: "",
        persona: "",
        scenario: "",
        exampleDialogues: "",
        style: "",
        constraints: "",
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const context = threadRequestContextNode.createRequestContext(
      {
        roleId: "role-1",
        contextSummary: "当前线程摘要",
        contextSummaryUpdatedAt: "2026-06-26T00:00:00.000Z",
        agentEnabled: false,
      },
      1,
    );

    expect(context.messages).toHaveLength(2);
    expect(context.messages[0]?.content).toContain("角色名：Programmer");
    expect(context.messages[1]?.content).toContain("线程摘要");
  });

  it("keeps resolver order stable when memory is present: role, summary, memory, agent", () => {
    vi.spyOn(roleService, "getRoleById").mockReturnValue({
      id: "role-1",
      name: "Programmer",
      summary: "",
      avatarId: null,
      status: "active",
      tags: [],
      prompt: {
        description: "你是一个程序员人设。",
        worldview: "",
        persona: "",
        scenario: "",
        exampleDialogues: "",
        style: "",
        constraints: "",
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const context = threadRequestContextNode.createRequestContext(
      {
        roleId: "role-1",
        contextSummary: "当前线程摘要",
        contextSummaryUpdatedAt: "2026-06-26T00:00:00.000Z",
        memoryContext: "用户长期偏好：先给结论。",
        memoryContextUpdatedAt: "2026-06-27T00:00:00.000Z",
        agentEnabled: true,
      },
      1,
    );

    expect(context.messages).toHaveLength(4);
    expect(context.messages[0]?.content).toContain("角色名：Programmer");
    expect(context.messages[1]?.content).toContain("线程摘要");
    expect(context.messages[2]?.content).toContain("长期记忆");
    expect(context.messages[3]?.content).toContain("智能体模式");
    expect(context.messages[3]?.requestContextScope).toBe("agent-execution");
  });

  it("appends agent context after role and summary when enabled", () => {
    vi.spyOn(roleService, "getRoleById").mockReturnValue({
      id: "role-1",
      name: "Programmer",
      summary: "",
      avatarId: null,
      status: "active",
      tags: [],
      prompt: {
        description: "你是一个程序员人设。",
        worldview: "",
        persona: "",
        scenario: "",
        exampleDialogues: "",
        style: "",
        constraints: "",
      },
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    const context = threadRequestContextNode.createRequestContext(
      {
        roleId: "role-1",
        contextSummary: "当前线程摘要",
        contextSummaryUpdatedAt: "2026-06-26T00:00:00.000Z",
        memoryContext: null,
        memoryContextUpdatedAt: null,
        agentEnabled: true,
      },
      1,
    );

    expect(context.messages).toHaveLength(3);
    expect(context.messages[2]?.content).toContain("智能体模式");
    expect(context.messages[2]?.requestContextScope).toBe("agent-execution");
  });
});
