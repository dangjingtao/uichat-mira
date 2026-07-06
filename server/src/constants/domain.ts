export const USER_ROLE_VALUES = ["admin", "user"] as const;
export const MODEL_TYPE_VALUES = [
  "llm",
  "embedding",
  "rerank",
  "task",
  "agentTask",
  "evaluation",
  "imageGeneration",
] as const;
export const MESSAGE_ROLE_VALUES = ["user", "assistant", "system"] as const;
export const THREAD_STATUS_VALUES = ["active", "archived", "deleted"] as const;
export const ROLE_STATUS_VALUES = ["active", "draft"] as const;

export const MAX_MESSAGE_CONTENT_LENGTH = 100 * 1024;
