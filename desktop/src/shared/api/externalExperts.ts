import { get, post } from "@/shared/lib/request";

export type ExternalExpertProvider = "chatgpt" | "kimi" | "deepseek";
export type ExternalSessionRef = {
  kind: "conversation_id" | "url" | "provider_state";
  value: string;
};

export type ExternalExpert = {
  id: string;
  name: string;
  provider: ExternalExpertProvider;
  externalSessionRef: ExternalSessionRef | null;
  accountLabel: string | null;
  status: "unbound" | "ready" | "expired" | "error";
  createdAt: string;
  updatedAt: string;
};

export const listExternalExperts = () => get<ExternalExpert[]>("/microapps/external-experts");

export const createExternalExpert = (input: { name: string; provider: ExternalExpertProvider }) =>
  post<ExternalExpert>("/microapps/external-experts", input);

export const connectExternalExpert = (id: string) =>
  post<ExternalExpert>(`/microapps/external-experts/${encodeURIComponent(id)}/connect`, {});

export const consultExternalExpert = (id: string, message: string) =>
  post<{ provider: ExternalExpertProvider; sessionRef?: ExternalSessionRef; reply: string }>(
    `/microapps/external-experts/${encodeURIComponent(id)}/consult`,
    { message },
    { timeout: 130000 },
  );
