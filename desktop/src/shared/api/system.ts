import { get } from "@/shared/lib/request";

export interface ServiceHealthData {
  service: string;
}

export interface AppMetaData {
  name: string;
  version: string;
  displayName: string;
  author: string;
  description: string;
  repositoryUrl: string;
  homepageUrl: string;
  changelog: string[];
  versionHistory: Array<{
    version: string;
    summary: string;
  }>;
  links: Array<{
    label: string;
    value: string;
    href: string;
  }>;
}

export interface DatabaseHealthData {
  ok: boolean;
  configured: boolean;
  mode: string;
  detail: string;
  vectorStore: {
    ok: boolean;
    provider: "sqlite-vec";
    detail: string;
    extensionPath?: string;
  };
}

export function getServiceHealth() {
  return get<ServiceHealthData>("/health");
}

export function getAppMeta() {
  return get<AppMetaData>("/app/meta");
}

export function getDatabaseHealth() {
  return get<DatabaseHealthData>("/db/health");
}
