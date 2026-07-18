import { del, get, post, put } from "../lib/request";
import type { AccessPointPreview } from "../types/access-point-preview";

export type { AccessPointPreview } from "../types/access-point-preview";

export type NotionCapability = {
  code: string;
  label: string;
  status: "available" | "reserved" | "blocked";
  description: string;
};

export type NotionConnectionResponse = {
  connection: {
    id: string;
    name: string;
    workspaceId: string | null;
    workspaceName: string | null;
    authMode: "internal_token";
    enabled: boolean;
    defaultReadOnly: boolean;
    status: "unconfigured" | "validating" | "connected" | "error" | "disabled";
    hasToken: boolean;
    maskedToken: string;
    lastValidatedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
  capabilities: NotionCapability[];
};

export type NotionAccessPoint = {
  id: string;
  name: string;
  type: "page_scope" | "database" | "publish_target";
  resourceId: string;
  resourceUrl: string | null;
  resourceTitle: string;
  enabled: boolean;
  includeChildren: boolean;
  allowedActions: string[];
  verificationStatus: "pending" | "verified" | "error" | "disabled";
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
};

export type NotionActivity = {
  id: string;
  action: string;
  accessPointId: string | null;
  resourceId: string | null;
  status: "completed" | "failed" | "blocked";
  summary: string;
  occurredAt: string;
  traceId: string | null;
};

export function getNotionConnection() {
  return get<NotionConnectionResponse>("/microapps/notion");
}

export function validateNotionConnection(token?: string) {
  return post<NotionConnectionResponse>("/microapps/notion/validate", token ? { token } : {});
}

export function saveNotionConnection(input: {
  name: string;
  token?: string;
  enabled: boolean;
  defaultReadOnly: boolean;
}) {
  return put<NotionConnectionResponse>("/microapps/notion", input);
}

export function getNotionAccessPoints() {
  return get<{ accessPoints: NotionAccessPoint[] }>("/microapps/notion/access-points");
}

export function getNotionActivities(limit?: number) {
  const suffix = limit === undefined ? "" : `?limit=${encodeURIComponent(String(limit))}`;
  return get<{ activities: NotionActivity[] }>(`/microapps/notion/activities${suffix}`);
}

export function getNotionAccessPointPreview(id: string) {
  return get<{ preview: AccessPointPreview }>(`/microapps/notion/access-points/${id}/preview`);
}

export function createNotionAccessPoint(input: {
  name: string;
  type: NotionAccessPoint["type"];
  resourceId: string;
  resourceUrl?: string | null;
  includeChildren?: boolean;
  allowedActions: string[];
}) {
  return post<{ accessPoint: NotionAccessPoint }>("/microapps/notion/access-points", input);
}

export function validateNotionAccessPoint(id: string) {
  return post<{ accessPoint: NotionAccessPoint }>(`/microapps/notion/access-points/${id}/validate`);
}

export function deleteNotionAccessPoint(id: string) {
  return del<{ deleted: boolean }>(`/microapps/notion/access-points/${id}`);
}
