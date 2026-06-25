import type { RoleStatus } from "@/db/schema";

export interface RoleListQuery {
  status?: RoleStatus;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export interface RolePromptBody {
  description?: string;
  worldview?: string;
  persona?: string;
  scenario?: string;
  exampleDialogues?: string;
  style?: string;
  constraints?: string;
}

export interface RoleLlmProfileBody {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface RoleMutationBody {
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: RoleStatus;
  tags?: string[];
  prompt?: RolePromptBody;
  llmProfile?: RoleLlmProfileBody;
}
