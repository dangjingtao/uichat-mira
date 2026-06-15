import { get } from "@/shared/lib/request";

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  category: "rag" | "system" | "tool";
  tags: string[];
  author?: string;
  parameters?: Record<string, unknown>;
  runtime?: Record<string, unknown>;
}

export function getTools() {
  return get<ToolDefinition[]>("/tools");
}
