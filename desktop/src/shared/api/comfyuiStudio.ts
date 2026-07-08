import { get, patch, post } from "@/shared/lib/request";

const COMFYUI_CONNECTIONS_ROUTE = "/microapps/image-generation/comfyui/connections";
const COMFYUI_FLOWS_ROUTE = "/microapps/image-generation/comfyui/flows";

export type ComfyUiConnectionStatus =
  | "unconfigured"
  | "unverified"
  | "connectable"
  | "failed";

export type ComfyUiNodeMapping = {
  promptPath: string;
  seedPath: string;
  widthPath: string;
  heightPath: string;
  outputNodeId: string;
  previewNodeId: string;
};

export type ComfyUiConnection = {
  id: string;
  baseUrl: string;
  clientId: string;
  status: ComfyUiConnectionStatus;
  lastError: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  } | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComfyUiFlow = {
  id: string;
  connectionId: string | null;
  name: string;
  note: string;
  source: "template" | "upload" | "manual";
  workflowApiJson: string;
  mapping: ComfyUiNodeMapping;
  createdAt: string;
  updatedAt: string;
};

export async function listComfyUiConnections(): Promise<ComfyUiConnection[]> {
  return get<ComfyUiConnection[]>(COMFYUI_CONNECTIONS_ROUTE);
}

export async function createComfyUiConnection(payload: {
  baseUrl: string;
  clientId?: string;
}): Promise<ComfyUiConnection> {
  return post<ComfyUiConnection>(COMFYUI_CONNECTIONS_ROUTE, payload);
}

export async function updateComfyUiConnection(
  id: string,
  payload: { baseUrl: string; clientId?: string },
): Promise<ComfyUiConnection> {
  return patch<ComfyUiConnection>(`${COMFYUI_CONNECTIONS_ROUTE}/${encodeURIComponent(id)}`, payload);
}

export async function testComfyUiConnection(id: string): Promise<ComfyUiConnection> {
  return post<ComfyUiConnection>(
    `${COMFYUI_CONNECTIONS_ROUTE}/${encodeURIComponent(id)}/test`,
  );
}

export async function listComfyUiFlows(): Promise<ComfyUiFlow[]> {
  return get<ComfyUiFlow[]>(COMFYUI_FLOWS_ROUTE);
}

export async function createComfyUiFlow(payload: {
  connectionId?: string | null;
  name: string;
  note?: string;
  source?: "template" | "upload" | "manual";
  workflowApiJson: string;
  mapping: ComfyUiNodeMapping;
}): Promise<ComfyUiFlow> {
  return post<ComfyUiFlow>(COMFYUI_FLOWS_ROUTE, payload);
}

export async function updateComfyUiFlow(
  id: string,
  payload: {
    connectionId?: string | null;
    name: string;
    note?: string;
    source?: "template" | "upload" | "manual";
    workflowApiJson: string;
    mapping: ComfyUiNodeMapping;
  },
): Promise<ComfyUiFlow> {
  return patch<ComfyUiFlow>(`${COMFYUI_FLOWS_ROUTE}/${encodeURIComponent(id)}`, payload);
}
