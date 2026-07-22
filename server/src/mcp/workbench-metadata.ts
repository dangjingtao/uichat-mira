import type { McpToolDefinition } from "./core/definitions.js";
import { resolveHarnessCapabilityProfiles } from "../harness/profiles/resolver.js";

type WorkbenchPresentation = Omit<
  NonNullable<McpToolDefinition["workbench"]>,
  "groupId" | "defaultArgs"
>;

const DOMAIN_METADATA: Record<string, WorkbenchPresentation> = {
  read: {
    groupLabel: "阅读",
    groupDescription: "文件读取、目录浏览、定位与片段提取。",
    groupOrder: 10,
    icon: "file-search",
  },
  edit: {
    groupLabel: "编辑",
    groupDescription: "文件写入、精确替换、删除与移动。",
    groupOrder: 20,
    icon: "pencil",
  },
  web_search: {
    groupLabel: "网络搜索",
    groupDescription: "公网实时搜索与本地新闻源检索。",
    groupOrder: 30,
    icon: "globe",
  },
  terminal: {
    groupLabel: "终端",
    groupDescription: "命令执行、调试链路与长任务观察。",
    groupOrder: 40,
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
  write_file: { path: "", content: "" },
  replace_block: { path: "", expectedOldText: "", newText: "" },
  delete_path: { path: "" },
  move_path: { path: "", destinationPath: "" },
  web_search: { query: "" },
  news_search: { query: "" },
  terminal_session: { command: "" },
};

const fallbackDomainMetadata = (domain: string) => ({
  groupLabel: domain
    .split(/[._-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
  groupDescription: `${domain} capability tools.`,
  groupOrder: 1000,
  icon: "wrench",
});

export const withWorkbenchMetadata = (
  definitions: McpToolDefinition[],
  ownershipDefinitions: McpToolDefinition[] = definitions,
): McpToolDefinition[] => {
  const explicitOwnership = new Map<
    string,
    { groupId: string; presentation: WorkbenchPresentation }
  >();

  for (const profile of resolveHarnessCapabilityProfiles(ownershipDefinitions)) {
    if (!profile.workbench) {
      continue;
    }
    for (const toolId of profile.supportingToolIds) {
      explicitOwnership.set(toolId, {
        groupId: profile.id,
        presentation: {
          groupLabel: profile.workbench.label,
          groupDescription: profile.workbench.description,
          groupOrder: profile.workbench.order,
          icon: profile.workbench.icon,
        },
      });
    }
  }

  return definitions.map((definition) => {
    const ownership = explicitOwnership.get(definition.id);
    return {
      ...definition,
      workbench: {
        groupId: ownership?.groupId ?? definition.domain,
        ...(ownership?.presentation ??
          DOMAIN_METADATA[definition.domain] ??
          fallbackDomainMetadata(definition.domain)),
        ...(DEFAULT_ARGS[definition.id] ? { defaultArgs: DEFAULT_ARGS[definition.id] } : {}),
      },
    };
  });
};
