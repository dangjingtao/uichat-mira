const normalizeQuery = (value: string | undefined) => value?.trim().toLowerCase() ?? "";

const GREETING_TOKENS = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "你好",
  "您好",
  "嗨",
  "哈喽",
]);

const SMALL_TALK_TOKENS = new Set([
  "thanks",
  "thank you",
  "谢谢",
  "谢了",
  "ok",
  "okay",
]);

export const SAFE_CHAT_DOMAINS = new Set([
  "read",
  "web_search",
]);

export const WORKSPACE_READ_HINTS = [
  "workspace",
  "工作区",
  "工作空间",
  "file",
  "files",
  "folder",
  "folders",
  "directory",
  "directories",
  "path",
  "paths",
  "read_list",
  "read_locate",
  "read_open",
  "文件",
  "文件夹",
  "目录",
  "路径",
  "列出",
  "看看",
] as const;

export const WEB_SEARCH_INTENT_HINTS = [
  "今天",
  "当前",
  "现在",
  "实时",
  "最新",
  "联网",
  "日期",
  "时间",
  "news",
  "latest",
  "current",
  "today",
  "weather",
  "price",
] as const;

export const DIRECTORY_LISTING_HINTS = [
  "folder",
  "folders",
  "directory",
  "directories",
  "list",
  "listing",
  "tree",
  "文件夹",
  "目录",
  "列出",
  "下面有",
  "有哪些",
] as const;

export const TERMINAL_COMMAND_INTENT_HINTS = [
  "command",
  "commands",
  "terminal",
  "shell",
  "powershell",
  "cmd",
  "bash",
  "run ",
  "execute",
  "exec",
  "pnpm",
  "npm",
  "node ",
  "git ",
  "dir",
  "ls",
  "终端",
  "命令",
] as const;

export const TERMINAL_COMMAND_INTENT_PATTERNS = [
  /执行.{0,8}命令/,
  /运行.{0,8}命令/,
  /跑.{0,8}命令/,
] as const;

export const LOW_INTENT_TOKENS = new Set([
  ...GREETING_TOKENS,
  ...SMALL_TALK_TOKENS,
]);

export const isLowIntentQuery = (query: string) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  if (GREETING_TOKENS.has(normalized) || SMALL_TALK_TOKENS.has(normalized)) {
    return true;
  }

  const compact = normalized.replace(/[!,.?。，！？\s]+/g, " ").trim();
  if (!compact) {
    return false;
  }

  const tokens = compact.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) {
    return false;
  }

  return tokens.every((token) => GREETING_TOKENS.has(token) || SMALL_TALK_TOKENS.has(token));
};

export const querySuggestsWorkspaceRead = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return WORKSPACE_READ_HINTS.some((token) => normalized.includes(token));
};

export const querySuggestsWebSearch = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return WEB_SEARCH_INTENT_HINTS.some((token) => normalized.includes(token));
};

export const querySuggestsDirectoryListing = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return DIRECTORY_LISTING_HINTS.some((token) => normalized.includes(token));
};

export const querySuggestsTerminalCommand = (query: string | undefined) => {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    return false;
  }

  return (
    TERMINAL_COMMAND_INTENT_HINTS.some((token) => normalized.includes(token)) ||
    TERMINAL_COMMAND_INTENT_PATTERNS.some((pattern) => pattern.test(normalized))
  );
};
