import { get } from "@/shared/lib/request";

export interface ServiceHealthData {
  service: string;
}

export interface GitCommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitVersionInfo {
  version: string;
  commit: GitCommitInfo;
}

export interface GitInfo {
  branch: string;
  versions: GitVersionInfo[];
}

export interface AppMetaData {
  name: string;
  version: string;
  displayName: string;
  author: string;
  description: string;
  repositoryUrl: string;
  homepageUrl: string;
  links: Array<{
    label: string;
    value: string;
    href: string;
  }>;
  git?: GitInfo;
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
