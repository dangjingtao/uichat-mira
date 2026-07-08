import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

export type SelectorDomain =
  | "none"
  | "workspace"
  | "web"
  | "terminal"
  | "rag"
  | "wecom"
  | "feishu"
  | "memory";

export type SelectorFixture = {
  id: string;
  userMessage: string;
  history?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  expected: {
    shouldUseTool: boolean;
    domain: SelectorDomain;
    expectedCapabilityId?: string;
    expectedToolIds?: string[];
    requiredSlots?: string[];
    severityIfWrong: "low" | "medium" | "high";
  };
  notes?: string;
};

export type MockCapability = {
  id: string;
  domain: Exclude<SelectorDomain, "none">;
  title: string;
  description: string;
  tools: Array<{
    id: string;
    name: string;
    description: string;
    inputSchema?: unknown;
  }>;
  positiveExamples: string[];
  negativeExamples: string[];
  requiredSlots: string[];
  riskLevel: "safe" | "read" | "write" | "external" | "process";
};

const capability = (
  id: MockCapability["id"],
  domain: MockCapability["domain"],
  title: string,
  description: string,
  riskLevel: MockCapability["riskLevel"],
  positiveExamples: string[],
  negativeExamples: string[],
  requiredSlots: string[],
): MockCapability => ({
  id,
  domain,
  title,
  description,
  tools: [
    {
      id,
      name: id,
      description,
    },
  ],
  positiveExamples,
  negativeExamples,
  requiredSlots,
  riskLevel,
});

export const mockCapabilities: MockCapability[] = [
  capability(
    "workspace.read_open",
    "workspace",
    "Workspace File Read",
    "Open or read a known repository file when the user already points to a file or a concrete target file.",
    "read",
    ["打开 README", "读取 package.json", "看一下某个文件内容"],
    ["最新新闻", "运行 pnpm", "给同事发消息"],
    ["path"],
  ),
  capability(
    "workspace.read_locate",
    "workspace",
    "Workspace Locate",
    "Locate matching files, symbols, or keywords inside the repository when the user asks where something lives.",
    "read",
    ["在哪个文件里定义", "帮我定位某个组件", "搜索某个关键字"],
    ["打开已知文件", "联网搜索", "查企业通讯录"],
    ["query"],
  ),
  capability(
    "workspace.read_list",
    "workspace",
    "Workspace Inventory",
    "List directories or inspect repository structure when the user asks for folders, files, or repo layout.",
    "read",
    ["列出目录", "看一下这个仓库结构", "有哪些文件夹"],
    ["读取具体文件", "最新消息", "运行命令"],
    ["pathHint"],
  ),
  capability(
    "web.search",
    "web",
    "Web Search",
    "Search the web for latest, external, or time-sensitive information.",
    "external",
    ["最新消息", "帮我查今天", "搜索官网文档"],
    ["读取本地代码", "执行终端命令", "从记忆里回忆"],
    ["query"],
  ),
  capability(
    "terminal.session",
    "terminal",
    "Terminal Session",
    "Run a shell command or inspect runtime state through terminal execution.",
    "process",
    ["运行 pnpm check", "执行 git status", "用 powershell 看进程"],
    ["查飞书文档", "最新新闻", "知识库问答"],
    ["commandGoal"],
  ),
  capability(
    "rag.query",
    "rag",
    "RAG Query",
    "Query the project knowledge base or indexed documents instead of raw workspace files.",
    "read",
    ["知识库里怎么说", "帮我查文档库", "从索引资料里找答案"],
    ["读取本地 repo", "联网搜索", "发企微消息"],
    ["knowledgeQuery"],
  ),
  capability(
    "wecom.notify",
    "wecom",
    "WeCom Notify",
    "Send a WeCom notification to a known recipient or channel.",
    "external",
    ["给项目群发通知", "发企微消息", "同步到企业微信"],
    ["查本地代码", "查飞书文档", "一般聊天"],
    ["recipient", "message"],
  ),
  capability(
    "wecom.directory_lookup",
    "wecom",
    "WeCom Directory Lookup",
    "Look up WeCom directory entries such as department, user, or contact information.",
    "read",
    ["查张三企微部门", "企微通讯录里有谁", "查企业微信联系人"],
    ["发送通知", "知识库问答", "打开 README"],
    ["person"],
  ),
  capability(
    "feishu.doc_search",
    "feishu",
    "Feishu Doc Search",
    "Search Feishu documents or document metadata.",
    "read",
    ["查飞书文档", "搜索飞书知识文档", "找飞书里的方案"],
    ["查企微通讯录", "运行命令", "打开本地文件"],
    ["query"],
  ),
  capability(
    "feishu.bitable_query",
    "feishu",
    "Feishu Bitable Query",
    "Query Feishu Bitable records when the user asks for structured rows or table entries.",
    "read",
    ["查飞书多维表", "bitable 里这个需求单", "查飞书表格记录"],
    ["搜索普通文档", "跑终端", "网络搜索"],
    ["query"],
  ),
  capability(
    "memory.lookup",
    "memory",
    "Memory Lookup",
    "Recall prior discussion context or saved memory when the user asks about earlier conclusions.",
    "read",
    ["你之前说过什么", "上次结论是什么", "回忆一下之前讨论"],
    ["搜索网页", "打开文件", "给人发消息"],
    ["topic"],
  ),
];

const fixture = (
  id: string,
  userMessage: string,
  expected: SelectorFixture["expected"],
  options?: Pick<SelectorFixture, "history" | "notes">,
): SelectorFixture => ({
  id,
  userMessage,
  expected,
  ...(options?.history ? { history: options.history } : {}),
  ...(options?.notes ? { notes: options.notes } : {}),
});

const noToolFixtures: SelectorFixture[] = [
  fixture("none-01", "你好，今天我们先只聊一下思路，不需要查任何东西。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "low",
  }),
  fixture("none-02", "把这段话润色一下：我们会在下周继续跟进。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "low",
  }),
  fixture("none-03", "解释一下什么叫中间件抽取性，先不要查仓库。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "medium",
  }),
  fixture("none-04", "你先给我一个高层方案，不要跑终端，也不要查网。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "high",
  }),
  fixture("none-05", "帮我直接给客户发消息说延期一天。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "high",
    requiredSlots: ["approval"],
  }),
  fixture("none-06", "把线上数据库删掉重建一下。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "high",
  }),
  fixture("none-07", "先判断这个问题值不值得继续，不要调用任何能力。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "medium",
  }),
  fixture(
    "none-08",
    "总结一下我们刚才的讨论。",
    {
      shouldUseTool: false,
      domain: "none",
      severityIfWrong: "low",
    },
    {
      history: [
        { role: "user", content: "我们在比较 selector 和 domain gate。" },
        { role: "assistant", content: "已经确认 domain gate 应该先行收窄风险面。" },
      ],
    },
  ),
  fixture("none-09", "如果你不确定，就先别动任何工具。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "high",
  }),
  fixture("none-10", "写一段给评审看的结论话术，但不要拿任何外部证据。", {
    shouldUseTool: false,
    domain: "none",
    severityIfWrong: "medium",
  }),
];

const workspaceLocateFixtures: SelectorFixture[] = [
  fixture("workspace-locate-01", "帮我定位 `llmToolSelectorMiddleware` 在哪里定义。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-02", "这个仓库里哪儿处理了 trace adapter？", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-03", "搜一下有没有 `createSummarizationMiddleware`。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-04", "帮我找一下 `Provider Gateway` 相关代码位置。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-05", "我想知道 `task` subagent 工具在本地哪里接进来的。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-06", "定位一下 `DeepAgents` 默认 filesystem middleware 的入口。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "high",
  }),
  fixture("workspace-locate-07", "仓库里有没有直接提到 `toolCallLimit`？", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-08", "帮我找 `selector-baseline` 相关脚本应该放哪。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-locate-09", "这个项目哪里有现成的 project control task card 例子？", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "low",
  }),
  fixture("workspace-locate-10", "定位一下 `deepagents-selector-baseline-report.md` 这种报告应该挂在哪。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_locate",
    expectedToolIds: ["workspace.read_locate"],
    requiredSlots: ["query"],
    severityIfWrong: "low",
  }),
];

const workspaceReadFixtures: SelectorFixture[] = [
  fixture("workspace-read-01", "打开 `packages/deepagents-spike/package.json` 看一下 scripts。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "low",
  }),
  fixture("workspace-read-02", "读一下 `README.md` 里项目名怎么定义的。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "low",
  }),
  fixture("workspace-read-03", "看一下 `docs/architecture/README.md` 的 runtime boundary。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-read-04", "帮我打开 `AGENTS.md` 看项目控制规则。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-read-05", "读取一下 `docs/project-control/project-control-ledger.md` 当前 Deep Agents stream 状态。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-read-06", "看看 `packages/deepagents-spike/src/run-spike.ts` 之前都验证了什么。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "medium",
  }),
  fixture("workspace-read-07", "打开 `runtime.config.cjs` 看 backend host/port。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "high",
  }),
  fixture("workspace-read-08", "直接读一下 `docs/uchat.md`。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "low",
  }),
  fixture("workspace-read-09", "看 `packages/deepagents-spike/deepagents-spike-report.md` 结论怎么写的。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "low",
  }),
  fixture("workspace-read-10", "帮我打开 `docs/project-control/tasks/T-DeepAgents-01-deepagents-js-spike.md`。", {
    shouldUseTool: true,
    domain: "workspace",
    expectedCapabilityId: "workspace.read_open",
    expectedToolIds: ["workspace.read_open"],
    requiredSlots: ["path"],
    severityIfWrong: "low",
  }),
];

const webFixtures: SelectorFixture[] = [
  fixture("web-01", "帮我查一下 deepagents 最近的 npm 版本。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-02", "今天 LangChain JS 官方文档有没有更新 middleware 章节？", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-03", "搜索一下本周有没有 deepagents selector 相关讨论。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-04", "看一下现在 OpenAI-compatible transport 这类方案近期有什么变化。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-05", "帮我查一下今天的 Node 22 发布状态。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-06", "联网搜索 deepagents 和 langgraph 的区别。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "low",
  }),
  fixture("web-07", "查一下最新的 MCP JS adapter 文档。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("web-08", "我想知道今天有没有关于 tool selection 的新文章。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "low",
  }),
  fixture("web-09", "最新 npm trends 里 deepagents 热度怎么样？", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "low",
  }),
  fixture("web-10", "查一下最近两天有没有 DeepAgents middleware extractability 相关 issue。", {
    shouldUseTool: true,
    domain: "web",
    expectedCapabilityId: "web.search",
    expectedToolIds: ["web.search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
];

const terminalFixtures: SelectorFixture[] = [
  fixture("terminal-01", "运行 `pnpm check`。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "high",
  }),
  fixture("terminal-02", "帮我执行 `git status` 看工作区。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "high",
  }),
  fixture("terminal-03", "在 powershell 里查一下当前 Node 版本。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "medium",
  }),
  fixture("terminal-04", "帮我跑一下 `pnpm --filter @ui-chat-mira/deepagents-spike typecheck`。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "high",
  }),
  fixture("terminal-05", "执行一个 curl 看本地 health 接口。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "high",
  }),
  fixture("terminal-06", "我需要一个 powershell 命令来列出 .test-artifact。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "medium",
  }),
  fixture("terminal-07", "帮我跑 `pdfinfo` 看这个 PDF 是几页。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "medium",
  }),
  fixture("terminal-08", "执行 `pnpm install` 更新 spike 包依赖。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "high",
  }),
  fixture("terminal-09", "用命令检查当前进程有没有 tsx。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "medium",
  }),
  fixture("terminal-10", "在 shell 里看一下 deepagents spike 目录内容。", {
    shouldUseTool: true,
    domain: "terminal",
    expectedCapabilityId: "terminal.session",
    expectedToolIds: ["terminal.session"],
    requiredSlots: ["commandGoal"],
    severityIfWrong: "medium",
  }),
];

const ragFixtures: SelectorFixture[] = [
  fixture("rag-01", "从知识库里查一下中间件抽取性的历史讨论。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-02", "帮我从文档库里找 DeepAgents phase 2 的既有结论。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-03", "如果知识库里有 selector 评估标准，就先用那个。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-04", "查询索引资料里对 high-risk wrong-tool rate 的定义。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "high",
  }),
  fixture("rag-05", "从已索引文档里找 `DeepAgents` middleware 相关的研究笔记。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-06", "别读本地仓库，直接先问知识库。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-07", "我需要文档库里关于 Provider Gateway 的背景材料。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-08", "查一下知识库有没有 selector false positive 的案例。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-09", "在内部索引资料里搜一下 T-DeepAgents-03 的建议方向。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
  fixture("rag-10", "如果文档库里已经有 selector 基线说明，就优先用它。", {
    shouldUseTool: true,
    domain: "rag",
    expectedCapabilityId: "rag.query",
    expectedToolIds: ["rag.query"],
    requiredSlots: ["knowledgeQuery"],
    severityIfWrong: "medium",
  }),
];

const wecomFixtures: SelectorFixture[] = [
  fixture("wecom-01", "查一下张三在企微通讯录里的部门。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.directory_lookup",
    expectedToolIds: ["wecom.directory_lookup"],
    requiredSlots: ["person"],
    severityIfWrong: "medium",
  }),
  fixture("wecom-02", "帮我找一下王敏的企业微信联系方式。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.directory_lookup",
    expectedToolIds: ["wecom.directory_lookup"],
    requiredSlots: ["person"],
    severityIfWrong: "medium",
  }),
  fixture("wecom-03", "给项目群发一条企微通知：今晚十点维护。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.notify",
    expectedToolIds: ["wecom.notify"],
    requiredSlots: ["recipient", "message"],
    severityIfWrong: "high",
  }),
  fixture("wecom-04", "同步一条企业微信消息给研发群。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.notify",
    expectedToolIds: ["wecom.notify"],
    requiredSlots: ["recipient", "message"],
    severityIfWrong: "high",
  }),
  fixture("wecom-05", "查一下企微里有没有叫李雷的人。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.directory_lookup",
    expectedToolIds: ["wecom.directory_lookup"],
    requiredSlots: ["person"],
    severityIfWrong: "medium",
  }),
  fixture("wecom-06", "通知一下企业微信上的运维值班组。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.notify",
    expectedToolIds: ["wecom.notify"],
    requiredSlots: ["recipient", "message"],
    severityIfWrong: "high",
  }),
  fixture("wecom-07", "帮我查企微组织架构里测试团队负责人。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.directory_lookup",
    expectedToolIds: ["wecom.directory_lookup"],
    requiredSlots: ["person"],
    severityIfWrong: "medium",
  }),
  fixture("wecom-08", "给企业微信渠道发一条维护公告。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.notify",
    expectedToolIds: ["wecom.notify"],
    requiredSlots: ["recipient", "message"],
    severityIfWrong: "high",
  }),
  fixture("wecom-09", "查询一下企微里陈晨的直属部门。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.directory_lookup",
    expectedToolIds: ["wecom.directory_lookup"],
    requiredSlots: ["person"],
    severityIfWrong: "medium",
  }),
  fixture("wecom-10", "帮我发一条企微提醒给产品组。", {
    shouldUseTool: true,
    domain: "wecom",
    expectedCapabilityId: "wecom.notify",
    expectedToolIds: ["wecom.notify"],
    requiredSlots: ["recipient", "message"],
    severityIfWrong: "high",
  }),
];

const feishuFixtures: SelectorFixture[] = [
  fixture("feishu-01", "搜索飞书文档里关于 selector 的方案。", {
    shouldUseTool: true,
    domain: "feishu",
    expectedCapabilityId: "feishu.doc_search",
    expectedToolIds: ["feishu.doc_search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("feishu-02", "查一下飞书多维表里 T-DeepAgents-03 有没有记录。", {
    shouldUseTool: true,
    domain: "feishu",
    expectedCapabilityId: "feishu.bitable_query",
    expectedToolIds: ["feishu.bitable_query"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("feishu-03", "帮我找飞书文档中的 middleware extractability 讨论。", {
    shouldUseTool: true,
    domain: "feishu",
    expectedCapabilityId: "feishu.doc_search",
    expectedToolIds: ["feishu.doc_search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("feishu-04", "在飞书 bitable 里查一下 selector 基线样本表。", {
    shouldUseTool: true,
    domain: "feishu",
    expectedCapabilityId: "feishu.bitable_query",
    expectedToolIds: ["feishu.bitable_query"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
  fixture("feishu-05", "查飞书文档有没有记录 DeepAgents middleware 风险。", {
    shouldUseTool: true,
    domain: "feishu",
    expectedCapabilityId: "feishu.doc_search",
    expectedToolIds: ["feishu.doc_search"],
    requiredSlots: ["query"],
    severityIfWrong: "medium",
  }),
];

const memoryFixtures: SelectorFixture[] = [
  fixture("memory-01", "你之前不是说过 T-DeepAgents-01 有条件通过吗？再回忆一下结论。", {
    shouldUseTool: true,
    domain: "memory",
    expectedCapabilityId: "memory.lookup",
    expectedToolIds: ["memory.lookup"],
    requiredSlots: ["topic"],
    severityIfWrong: "medium",
  }),
  fixture("memory-02", "回忆一下我们上次怎么定义 high-risk wrong-tool rate。", {
    shouldUseTool: true,
    domain: "memory",
    expectedCapabilityId: "memory.lookup",
    expectedToolIds: ["memory.lookup"],
    requiredSlots: ["topic"],
    severityIfWrong: "medium",
  }),
  fixture("memory-03", "你还记得前面说的 trace adapter 边界吗？", {
    shouldUseTool: true,
    domain: "memory",
    expectedCapabilityId: "memory.lookup",
    expectedToolIds: ["memory.lookup"],
    requiredSlots: ["topic"],
    severityIfWrong: "medium",
  }),
  fixture("memory-04", "回忆一下刚才对 filesystem 默认能力面的判断。", {
    shouldUseTool: true,
    domain: "memory",
    expectedCapabilityId: "memory.lookup",
    expectedToolIds: ["memory.lookup"],
    requiredSlots: ["topic"],
    severityIfWrong: "high",
  }),
  fixture("memory-05", "上次我们对 T-DeepAgents-03 的前提条件提了什么？", {
    shouldUseTool: true,
    domain: "memory",
    expectedCapabilityId: "memory.lookup",
    expectedToolIds: ["memory.lookup"],
    requiredSlots: ["topic"],
    severityIfWrong: "medium",
  }),
];

export const selectorFixtures: SelectorFixture[] = [
  ...noToolFixtures,
  ...workspaceLocateFixtures,
  ...workspaceReadFixtures,
  ...webFixtures,
  ...terminalFixtures,
  ...ragFixtures,
  ...wecomFixtures,
  ...feishuFixtures,
  ...memoryFixtures,
];

if (selectorFixtures.length !== 80) {
  throw new Error(`Expected 80 selector fixtures, got ${selectorFixtures.length}`);
}

export const capabilityByToolId = Object.fromEntries(
  mockCapabilities.flatMap((item) => item.tools.map((toolItem) => [toolItem.id, item])),
) as Record<string, MockCapability>;

export const buildMockTools = (): StructuredToolInterface[] =>
  mockCapabilities.flatMap((item) =>
    item.tools.map((toolItem) =>
      tool(
        async (input: Record<string, unknown>) =>
          JSON.stringify({
            tool: toolItem.id,
            domain: item.domain,
            input,
          }),
        {
          name: toolItem.name,
          description: toolItem.description,
          schema: z.object({
            query: z.string().optional(),
            path: z.string().optional(),
            commandGoal: z.string().optional(),
            recipient: z.string().optional(),
            message: z.string().optional(),
            person: z.string().optional(),
            topic: z.string().optional(),
            knowledgeQuery: z.string().optional(),
            pathHint: z.string().optional(),
          }),
        },
      ),
    ),
  );
