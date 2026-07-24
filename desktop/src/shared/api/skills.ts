import { del, get, post, put } from "@/shared/lib/request";

const SKILLS_ROUTE = "/skills";

export type SkillPackageOrigin = "built-in" | "user" | "external";
export type SkillPackageStatus = "bundled" | "installed";
export type SkillRuntimeStatus =
  | "not-required"
  | "not-installed"
  | "available"
  | "broken"
  | "unknown";

export type SkillRuntimeDisplay = {
  requirements: string[];
  status: SkillRuntimeStatus;
  missing?: string[];
  error?: string;
};

export type SkillCatalogItem = {
  id: string;
  version: string;
  name: string;
  source: string;
  category: string;
  description: string;
  origin: SkillPackageOrigin;
  packageStatus: SkillPackageStatus;
  featured: boolean;
  license?: string;
  runtimeRequirements: string[];
  runtime: SkillRuntimeDisplay;
};

export type SkillFileKind =
  | "entry"
  | "reference"
  | "template"
  | "example"
  | "script"
  | "runtime"
  | "license"
  | "other";

export type SkillFileDescriptor = {
  path: string;
  name: string;
  kind: SkillFileKind;
  extension: string;
  mimeType: string;
  size: number | null;
  previewable: boolean;
  contentAvailable: boolean;
  declaredOnly: boolean;
};

export type SkillDetail = SkillCatalogItem & {
  files: SkillFileDescriptor[];
};

export type SkillFileContent = {
  path: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
};

export type UpdateSkillInput = {
  name?: string;
  version?: string;
  source?: string;
  category?: string;
  description?: string;
  featured?: boolean;
};

export const getSkillCatalog = () => get<{ skills: SkillCatalogItem[] }>(`${SKILLS_ROUTE}/catalog`);

export const getSkillDetail = (id: string) =>
  get<SkillDetail>(`${SKILLS_ROUTE}/${encodeURIComponent(id)}`);

export const getSkillFileContent = (id: string, filePath: string) => {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return get<SkillFileContent>(`${SKILLS_ROUTE}/${encodeURIComponent(id)}/files/${encodedPath}`);
};

export const importSkillMarkdown = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return post<SkillDetail>(`${SKILLS_ROUTE}/import`, formData);
};

export const updateSkill = (id: string, input: UpdateSkillInput) =>
  put<SkillDetail>(`${SKILLS_ROUTE}/${encodeURIComponent(id)}`, input);

export const deleteSkill = (id: string) =>
  del<{ id: string }>(`${SKILLS_ROUTE}/${encodeURIComponent(id)}`);

export const installSkillRuntime = (id: string) =>
  post<SkillDetail>(`${SKILLS_ROUTE}/${encodeURIComponent(id)}/runtime/install`, {});
