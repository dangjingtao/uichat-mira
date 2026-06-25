import { del, get, patch, post } from "../lib/request";
import type {
  RoleDraft,
  RoleLlmProfile,
  RoleRecord,
  RoleStatus,
} from "@/features/Settings/pages/Personas/types";

export interface RoleSummary extends RoleRecord {
  createdAt: string;
  updatedAt: string;
}

export interface RoleMutationPayload {
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: RoleStatus;
  tags?: string[];
  prompt?: Partial<RoleDraft>;
  llmProfile?: Partial<RoleLlmProfile>;
}

export interface ListRolesParams {
  status?: RoleStatus;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export async function listRoles(
  params?: ListRolesParams,
): Promise<RoleSummary[]> {
  return get<RoleSummary[]>("/roles", { params });
}

export async function getRoleById(roleId: string): Promise<RoleSummary> {
  return get<RoleSummary>(`/roles/${roleId}`);
}

export async function createRole(
  payload: RoleMutationPayload,
): Promise<RoleSummary> {
  return post<RoleSummary>("/roles", payload);
}

export async function updateRole(
  roleId: string,
  payload: RoleMutationPayload,
): Promise<RoleSummary> {
  return patch<RoleSummary>(`/roles/${roleId}`, payload);
}

export async function deleteRole(
  roleId: string,
): Promise<{ deleted: boolean }> {
  return del<{ deleted: boolean }>(`/roles/${roleId}`);
}
