import { del, get, patch, post, put } from "@/shared/lib/request";

export type MemoryKind = "preference" | "fact" | "decision" | "constraint";

export interface MemoryRecord {
  id: string;
  kind: MemoryKind;
  content: string;
  origin: "conversation" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface MemoryOverview {
  enabled: boolean;
  records: MemoryRecord[];
}

export const getMemoryOverview = () => get<MemoryOverview>("/memory");

export const updateMemorySettings = (enabled: boolean) =>
  put<MemoryOverview>("/memory/settings", { enabled });

export const createMemory = (input: {
  kind: MemoryKind;
  content: string;
}) => post<MemoryOverview>("/memory", input);

export const updateMemory = (
  id: string,
  input: { kind: MemoryKind; content: string },
) => patch<MemoryOverview>(`/memory/${encodeURIComponent(id)}`, input);

export const deleteMemory = (id: string) =>
  del<MemoryOverview>(`/memory/${encodeURIComponent(id)}`);
