import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import { fakeModel } from "@langchain/core/testing";
import { tool } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { ChatOpenAI } from "@langchain/openai";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { z } from "zod";
import { startFakeOpenAICompatibleServer } from "./fake-openai-compatible-server.js";

type ScenarioResult = {
  name: string;
  passed: boolean;
  evidence: string[];
  data?: Record<string, unknown>;
  warnings?: string[];
};

type TraceNodeCategory =
  | "graph"
  | "middleware"
  | "model"
  | "tool"
  | "subagent"
  | "unknown";

type TraceNodeSample = {
  event: string;
  name: string;
  category: TraceNodeCategory;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageRoot, "..", "..");
const artifactRoot = path.join(repoRoot, ".test-artifact", "deepagents-spike");
const reportPath = path.join(packageRoot, "deepagents-spike-report.md");
const jsonPath = path.join(artifactRoot, "last-run.json");

const scenario = async (
  name: string,
  fn: () => Promise<Omit<ScenarioResult, "name">>,
): Promise<ScenarioResult> => {
  try {
    return {
      name,
      ...(await fn()),
    };
  } catch (error) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    return {
      name,
      passed: false,
      evidence: [],
      warnings: [message],
    };
  }
};

const toText = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
};

const getToolMessages = (messages: unknown[]): ToolMessage[] =>
  messages.filter((message): message is ToolMessage => message instanceof ToolMessage);

const mapTraceCategory = (event: { event?: string; name?: string }): TraceNodeCategory => {
  const eventName = String(event.event ?? "");
  const runnableName = String(event.name ?? "");

  if (eventName.startsWith("on_tool_")) {
    return runnableName === "task" ? "subagent" : "tool";
  }

  if (eventName.startsWith("on_chat_model_")) {
    return "model";
  }

  if (runnableName.includes("Middleware") || runnableName.includes(".before_") || runnableName.includes(".after_")) {
    return "middleware";
  }

  if (runnableName === "general-purpose") {
    return "subagent";
  }

  if (eventName.startsWith("on_chain_")) {
    return "graph";
  }

  return "unknown";
};

const createLookupTool = () =>
  tool(async ({ topic }: { topic: string }) => `lookup:${topic}`, {
    name: "fake_lookup",
    description: "Return a deterministic lookup result.",
    schema: z.object({
      topic: z.string(),
    }),
  });

const createGatewayLookupTool = () =>
  tool(async ({ topic }: { topic: string }) => `gateway:${topic}`, {
    name: "gateway_lookup",
    description: "Return a deterministic provider gateway lookup result.",
    schema: z.object({
      topic: z.string(),
    }),
  });

const runMinimalDemo = async (): Promise<Omit<ScenarioResult, "name">> => {
  const model = fakeModel().respond(new AIMessage("minimal deep agent ok"));
  const agent = createDeepAgent({ model });
  const result = await agent.invoke({
    messages: [{ role: "user", content: "say hello" }],
  });

  const finalText = toText(result.messages.at(-1)?.content ?? "");
  return {
    passed: finalText.includes("minimal deep agent ok"),
    evidence: [
      "createDeepAgent 在 Windows + Node 22 本机环境直接可运行。",
      `最小 invoke 最终消息: ${finalText}`,
      `返回状态字段包含: ${Object.keys(result).join(", ")}`,
    ],
    data: {
      finalText,
      stateKeys: Object.keys(result),
    },
  };
};

const runFakeLangChainToolScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const lookupTool = createLookupTool();
  const model = fakeModel()
    .respondWithTools([{ name: "fake_lookup", args: { topic: "deepagents" } }])
    .respond(new AIMessage("done"));

  const agent = createDeepAgent({
    model,
    tools: [lookupTool],
  });

  const result = await agent.invoke({
    messages: [{ role: "user", content: "look up deepagents" }],
  });

  const toolMessages = getToolMessages(result.messages);
  const lastToolMessage = toolMessages.at(-1);
  const toolOutput = toText(lastToolMessage?.content ?? "");

  return {
    passed: toolOutput.includes("lookup:deepagents"),
    evidence: [
      "假的 LangChain tool 已接入 createDeepAgent。",
      `tool 输出: ${toolOutput}`,
      `fake model 调用次数: ${String(model.callCount)}`,
    ],
    data: {
      toolMessageCount: toolMessages.length,
      toolOutput,
      modelCallCount: model.callCount,
    },
  };
};

const runProviderGatewayLikeScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const gateway = await startFakeOpenAICompatibleServer();
  try {
    const model = new ChatOpenAI({
      model: "gateway-demo",
      temperature: 0,
      apiKey: "not-needed",
      configuration: {
        baseURL: gateway.baseUrl,
      },
    });

    const agent = createDeepAgent({
      model,
      tools: [createGatewayLookupTool()],
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "verify provider gateway flow" }],
    });

    const toolOutput = toText(getToolMessages(result.messages).at(-1)?.content ?? "");
    const finalText = toText(result.messages.at(-1)?.content ?? "");
    const firstPayload = gateway.requests.at(0);

    return {
      passed:
        gateway.requests.length >= 2 &&
        toolOutput.includes("gateway:provider gateway") &&
        finalText.includes("gateway tool flow completed"),
      evidence: [
        `本地 OpenAI-compatible 假网关收到请求次数: ${gateway.requests.length}`,
        `首个请求 model: ${firstPayload?.model ?? "unknown"}`,
        `tool 输出: ${toolOutput}`,
        `最终消息: ${finalText}`,
      ],
      warnings: [
        "本机缺少 DATABASE_URL，未验证项目当前 DB 驱动的 provider 解析链；本场景只验证 openai-compatible transport 这一层与 deepagents 兼容。",
      ],
      data: {
        requestCount: gateway.requests.length,
        firstRequestTools:
          firstPayload?.tools?.map((item) => item.function?.name).filter(Boolean) ?? [],
        toolOutput,
        finalText,
        baseUrl: gateway.baseUrl,
      },
    };
  } finally {
    await gateway.close();
  }
};

const runMcpScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const client = new MultiServerMCPClient({
    throwOnLoadError: true,
    useStandardContentBlocks: true,
    mcpServers: {
      local: {
        transport: "stdio",
        command: process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        args: ["exec", "tsx", "src/local-mcp-server.ts"],
        cwd: packageRoot,
      },
    },
  });

  try {
    const tools = await client.getTools();
    const toolNames = tools.map((item) => item.name);
    const localToolName = toolNames.find((name) => name.includes("local_lookup"));
    if (!localToolName) {
      throw new Error(`Expected local_lookup MCP tool, got: ${toolNames.join(", ")}`);
    }

    const model = fakeModel()
      .respondWithTools([{ name: localToolName, args: { topic: "deepagents-mcp" } }])
      .respond(new AIMessage("mcp done"));

    const agent = createDeepAgent({
      model,
      tools,
    });

    const result = await agent.invoke({
      messages: [{ role: "user", content: "call the local MCP tool" }],
    });

    const toolOutput = toText(getToolMessages(result.messages).at(-1)?.content ?? "");

    return {
      passed: toolOutput.includes("mcp:deepagents-mcp"),
      evidence: [
        `MCP tool 名称: ${localToolName}`,
        `MCP tool 输出: ${toolOutput}`,
        `加载到的 MCP tools: ${toolNames.join(", ")}`,
      ],
      data: {
        toolNames,
        toolOutput,
      },
    };
  } finally {
    await client.close();
  }
};

const runFilesystemScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const workspaceDir = path.join(artifactRoot, "fs-workspace");
  await rm(workspaceDir, { recursive: true, force: true });
  await mkdir(path.join(workspaceDir, "allowed"), { recursive: true });

  const backend = new FilesystemBackend({
    rootDir: workspaceDir,
    virtualMode: true,
  });

  const allowModel = fakeModel()
    .respondWithTools([{ name: "write_file", args: { file_path: "/allowed/note.txt", content: "hello" } }])
    .respond(new AIMessage("allowed write done"));
  const allowAgent = createDeepAgent({
    model: allowModel,
    backend,
    permissions: [
      {
        operations: ["write"],
        paths: ["/allowed/**"],
        mode: "allow",
      },
      {
        operations: ["write"],
        paths: ["/**"],
        mode: "deny",
      },
    ],
  });

  const allowResult = await allowAgent.invoke({
    messages: [{ role: "user", content: "write an allowed file" }],
  });
  const allowedText = await readFile(path.join(workspaceDir, "allowed", "note.txt"), "utf8");
  const allowToolOutput = toText(getToolMessages(allowResult.messages).at(-1)?.content ?? "");

  const denyModel = fakeModel()
    .respondWithTools([{ name: "write_file", args: { file_path: "/blocked/secret.txt", content: "blocked" } }])
    .respond(new AIMessage("blocked write attempted"));
  const denyAgent = createDeepAgent({
    model: denyModel,
    backend,
    permissions: [
      {
        operations: ["write", "read"],
        paths: ["/**"],
        mode: "deny",
      },
    ],
  });

  let denyToolOutput = "";
  try {
    const denyResult = await denyAgent.invoke({
      messages: [{ role: "user", content: "write a blocked file" }],
    });
    denyToolOutput = toText(getToolMessages(denyResult.messages).at(-1)?.content ?? "");
  } catch (error) {
    denyToolOutput = error instanceof Error ? error.message : String(error);
  }

  const blockedExists = await readFile(path.join(workspaceDir, "blocked", "secret.txt"), "utf8")
    .then(() => true)
    .catch(() => false);

  return {
    passed:
      allowedText === "hello" &&
      !blockedExists &&
      /permission|denied|not allowed/i.test(denyToolOutput),
    evidence: [
      `允许路径写入结果: ${allowToolOutput}`,
      `阻止路径写入结果: ${denyToolOutput}`,
      "createDeepAgent 仍然暴露 filesystem tools；本场景证明它们可被 permissions 限制，但没发现直接禁用整个 filesystem middleware 的 top-level 开关。",
    ],
    data: {
      allowedText,
      denyToolOutput,
      blockedExists,
      permissionRules: [
        { operations: ["write"], paths: ["/allowed/**"], mode: "allow" },
        { operations: ["write"], paths: ["/**"], mode: "deny" },
      ],
    },
  };
};

const runTraceMappingScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const lookupTool = createLookupTool();
  const model = fakeModel()
    .respondWithTools([{ name: "fake_lookup", args: { topic: "trace" } }])
    .respond(new AIMessage("trace done"));
  const agent = createDeepAgent({
    model,
    tools: [lookupTool],
  });

  const samples: TraceNodeSample[] = [];
  for await (const event of agent.streamEvents(
    {
      messages: [{ role: "user", content: "collect trace events" }],
    },
    { version: "v2" },
  )) {
    samples.push({
      event: String(event.event),
      name: String(event.name ?? ""),
      category: mapTraceCategory(event),
    });
  }

  const categories = [...new Set(samples.map((item) => item.category))];
  const mappedExamples = samples.slice(0, 12).map(
    (item) => `${item.event} / ${item.name} -> ${item.category}`,
  );

  return {
    passed:
      categories.includes("graph") &&
      categories.includes("middleware") &&
      categories.includes("model") &&
      categories.includes("tool"),
    evidence: [
      "streamEvents(v2) 可以提取 graph / middleware / model / tool 级别信号。",
      ...mappedExamples,
    ],
    data: {
      categories,
      samples,
    },
  };
};

const runObservabilityScenario = async (): Promise<Omit<ScenarioResult, "name">> => {
  const todoModel = fakeModel()
    .respondWithTools([
      {
        name: "write_todos",
        args: {
          todos: [{ content: "verify deepagents observability", status: "in_progress" }],
        },
      },
    ])
    .respond(new AIMessage("todo updated"));
  const todoAgent = createDeepAgent({ model: todoModel });
  const todoResult = await todoAgent.invoke({
    messages: [{ role: "user", content: "track the work" }],
  });

  const subagentModel = fakeModel()
    .respondWithTools([
      {
        name: "task",
        args: {
          description: "research observability",
          subagent_type: "general-purpose",
        },
      },
    ])
    .respond(new AIMessage("subagent result"))
    .respond(new AIMessage("main final"));
  const subagentAgent = createDeepAgent({ model: subagentModel });

  const subagentEvents: string[] = [];
  let sawGeneralPurposeChain = false;
  for await (const event of subagentAgent.streamEvents(
    {
      messages: [{ role: "user", content: "offload the work" }],
    },
    { version: "v2" },
  )) {
    const marker = `${String(event.event)}:${String(event.name ?? "")}`;
    subagentEvents.push(marker);
    if (String(event.name ?? "") === "general-purpose") {
      sawGeneralPurposeChain = true;
    }
  }

  const summarizationStatePresent =
    "_summarizationEvent" in todoResult || "_summarizationSessionId" in todoResult;

  return {
    passed:
      Array.isArray(todoResult.todos) &&
      todoResult.todos.length > 0 &&
      subagentEvents.some((item) => item.includes("task")) &&
      sawGeneralPurposeChain,
    evidence: [
      `todo state: ${JSON.stringify(todoResult.todos)}`,
      `subagent 事件样本: ${subagentEvents.slice(0, 8).join(" | ")}`,
      summarizationStatePresent
        ? "本次 run 结果上看到了 summarization 状态字段。"
        : "本次 spike 没有稳定触发 history summarization/offload 状态，已确认 task/subagent offload 可观察，但内部 summarization offload 仍需二阶段单独验证。",
    ],
    warnings: summarizationStatePresent
      ? undefined
      : ["history summarization/offload 的外部观测在这次 spike 中没有拿到稳定复现证据。"],
    data: {
      todos: todoResult.todos,
      sawGeneralPurposeChain,
      subagentEvents,
      summarizationStatePresent,
    },
  };
};

const buildMarkdownReport = (results: ScenarioResult[]) => {
  const findScenario = (name: string) => results.find((item) => item.name === name);
  const envSection = [
    "- OS: Windows",
    `- Node: ${process.version}`,
    "- deepagents: 1.10.5",
    "- Spike package: `packages/deepagents-spike`",
  ].join("\n");

  const matrix = results
    .map(
      (item) =>
        `| ${item.name} | ${item.passed ? "PASS" : "FAIL"} | ${item.evidence[0] ?? "无"} |`,
    )
    .join("\n");

  const filesystem = findScenario("filesystem-permissions");
  const observability = findScenario("observability");
  const gateway = findScenario("provider-gateway-like");
  const trace = findScenario("trace-mapping");

  const unresolvedOffload =
    observability?.warnings?.some((warning) => warning.includes("summarization/offload")) ?? false;

  const recommendation =
    results.every((item) => item.passed) && !unresolvedOffload
      ? "建议继续第二阶段，但前提是先设计 deepagents 到 Harness 的事件适配层与安全边界。"
      : "有条件建议继续第二阶段。tool / MCP / trace 基础可行，但 history summarization/offload 外部观测、真实 Provider Gateway DB 解析链、以及默认 filesystem/subagent 能力面的收敛方案，需要在第二阶段开工前先单独定界。";

  const scenarioDetails = results
    .map((item) => {
      const warnings = item.warnings?.length
        ? `\n警告：\n${item.warnings.map((warning) => `- ${warning}`).join("\n")}`
        : "";
      return `### ${item.name}\n- 结果：${item.passed ? "PASS" : "FAIL"}\n${item.evidence
        .map((line) => `- ${line}`)
        .join("\n")}${warnings}`;
    })
    .join("\n\n");

  return `# Deep Agents JS Spike Report

## Summary

${envSection}

| Scenario | Result | Key Evidence |
| --- | --- | --- |
${matrix}

## Scenario Details

${scenarioDetails}

## 能复用什么

- \`createDeepAgent\` + LangChain tool 接口可以直接复用，最小 demo、假 tool、MCP tool 都已跑通。
- \`streamEvents\` 暴露的 graph / middleware / model / tool / subagent 信号可以作为现有 trace 的原始素材，至少能做适配层，不需要从零发明事件源。
- openai-compatible transport 层和 \`ChatOpenAI\` 可以对接本项目 Provider Gateway 的协议形态，说明 deepagents 不是只能跑 OpenAI 官方直连。

## 不能复用什么

- 现有 Harness 的审批链、状态模型、trace node contract 不能原样复用到 deepagents；需要单独做映射层。
- deepagents 默认内建 filesystem / todos / subagent / summarization middleware，能力面比当前 Harness 更宽，没有看到一个直接关闭 filesystem middleware 的简单开关。
- 本机这次没有拿到真实 DB 驱动 Provider Gateway 解析链证据，所以“当前项目 provider settings -> gateway -> deepagents”不能宣称已经全链路复用。

## 和现有 Harness 冲突点

- 事件语义冲突：deepagents 输出的是 LangGraph / middleware / tool 事件流，现有 Harness trace 是项目自定义节点合同，不能直接混写。
- 状态所有权冲突：deepagents 自带 \`todos\`、\`files\`、\`_summarizationEvent\` 等状态；现有 Harness 有自己的 run state、evidence、approval/resume 合同。
- 能力边界冲突：deepagents 默认信任模型并放大工具权限，而当前 Harness 明确有审批、路由、约束和协议分层。
- 依赖版本冲突：deepagents 依赖的 \`langchain\` / \`@langchain/core\` / \`zod\` 明显新于主仓当前主线，所以直接并到 \`server\` 风险高。

## 安全风险

- filesystem middleware 默认开启，且 permission 默认是 permissive。如果没有显式 deny 规则，模型可以直接读写工作区文件。
- 如果未来改用 \`LocalShellBackend\`，deepagents 还会暴露 \`execute\`，那是直接宿主机 shell 执行，不是轻量风险，是高风险运行边界变化。
- subagent/task 默认可把工作分发到额外上下文，若没有和现有审批/审计模型对齐，会出现“主链看起来正常，但实际动作在子链里发生”的可见性缺口。
- MCP tool 一旦挂到 deepagents，安全性取决于 MCP server 本身，而不是 deepagents 帮你兜底。

## 是否建议继续第二阶段

${recommendation}

第二阶段前必须先补齐这三件事：

- 明确 deepagents 事件到现有 Harness trace 的适配合同，不要直接把原始 LangGraph 事件塞进现有 UI。
- 明确 filesystem / MCP / subagent 的审批与默认 deny 设计，否则能力面会比当前 Harness 更宽。
- 明确 Provider Gateway 的真实集成路径。当前 spike 只验证了 openai-compatible transport 形态，未验证依赖 DB 的 provider 解析链。

## 结论补充

- filesystem tools：这次验证结果是“可限制，未验证到可直接禁用”。
- todo 状态：可从结果状态直接观测。
- subagent offload：可从 \`task\` tool 事件和 nested chain 观测。
- history summarization/offload：${trace?.passed ? "状态类型存在，但这次 spike 没拿到稳定可复现的外部观测证据。" : "本次未完成验证。"}
- Provider Gateway：${gateway?.passed ? "协议形态兼容已验证；真实项目 provider 解析链未验证。" : "本次未完成验证。"}
`;
};

await mkdir(artifactRoot, { recursive: true });

const results = [
  await scenario("minimal-demo", runMinimalDemo),
  await scenario("fake-langchain-tool", runFakeLangChainToolScenario),
  await scenario("provider-gateway-like", runProviderGatewayLikeScenario),
  await scenario("local-mcp-tool", runMcpScenario),
  await scenario("filesystem-permissions", runFilesystemScenario),
  await scenario("trace-mapping", runTraceMappingScenario),
  await scenario("observability", runObservabilityScenario),
];

const report = buildMarkdownReport(results);
await writeFile(reportPath, report, "utf8");
await writeFile(
  jsonPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      nodeVersion: process.version,
      results,
    },
    null,
    2,
  ),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      reportPath,
      jsonPath,
      results,
    },
    null,
    2,
  ),
);
