import type { ComponentType } from "react";

export type RolePreviewMode = "chat" | "rag";

export type RoleStatus = "active" | "draft";

export type RoleField =
  | "description"
  | "worldview"
  | "persona"
  | "scenario"
  | "exampleDialogues"
  | "style"
  | "constraints";

export type RoleDraft = {
  description: string;
  worldview: string;
  persona: string;
  scenario: string;
  exampleDialogues: string;
  style: string;
  constraints: string;
};

export type RoleLlmProfile = {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
};

export interface RoleRecord {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RoleDraft;
  llmProfile: RoleLlmProfile;
}

export interface FieldMeta {
  icon: ComponentType<{ className?: string }>;
}
