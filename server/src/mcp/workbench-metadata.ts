import type { McpToolDefinition } from "./core/definitions.js";

const DOMAIN_METADATA: Record<string, Omit<NonNullable<McpToolDefinition["workbench"]>, "defaultArgs">> = {
  read: {
    domainLabel: "阅读",
    domainDescription: "文件读取、目录浏览、定位与片段提取。",
    domainOrder: 10,
    icon: "file-search",
  },
  edit: {
    domainLabel: "编辑",
    domainDescription: "受控文件修改与补丁型写入。",
    domainOrder: 20,
    icon: "pencil",
  },
  web_search: {
    domainLabel: "网络搜索",
    domainDescription: "联网搜索、抓取结果与外部情报补充。",
    domainOrder: 30,
    icon: "globe",
  },
  terminal: {
    domainLabel: "终端",
    domainDescription: "命令执行、调试链路与长任务观察。",
    domainOrder: 40,
    icon: "terminal",
  },
};

const DEFAULT_ARGS: Record<string, Record<string, unknown>> = {
  read_discover: { mode: "list", path: "" },
  read_open: { path: "" },
  read_list: { path: "" },
  read_locate: { query: "" },
  read_extract: { path: "" },
  read_slice: { text: "" },
  edit_file: { path: "" },
  web_search: { query: "" },
  terminal_session: { command: "" },
};

const fallbackDomainMetadata = (domain: string) => ({
  domainLabel: domain
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  domainDescription: `${domain} capability tools.`,
  domainOrder: 1000,
  icon: "wrench",
});

export const withWorkbenchMetadata = (
  definition: McpToolDefinition,
): McpToolDefinition => ({
  ...definition,
  workbench: {
    ...(DOMAIN_METADATA[definition.domain] ?? fallbackDomainMetadata(definition.domain)),
    ...(DEFAULT_ARGS[definition.id] ? { defaultArgs: DEFAULT_ARGS[definition.id] } : {}),
  },
});
