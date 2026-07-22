export type SkillManifest = {
  id: string;
  name: string;
  description: string;
  version: string;
  entry: string;
  source?: string;
  license?: string;
  runtimeRequirements?: string[];
};

export type SkillContent = {
  manifest: SkillManifest;
  body: string;
};

export type SkillResourceKind = "reference" | "template" | "example" | "script";

export type SkillResource = {
  uri: string;
  skillId: string;
  name: string;
  kind: SkillResourceKind;
  description?: string;
};

export type LoadedSkillResource = SkillResource & {
  content: string;
};

export type SkillMatchSource =
  | "explicit"
  | "resource"
  | "exact"
  | "semantic"
  | "embedding";

export type SkillMatchCandidate = {
  skillId: string;
  score: number;
  reason: string;
  source: SkillMatchSource;
};

export type SkillMatchResult = {
  primary: SkillMatchCandidate | null;
  secondary: SkillMatchCandidate[];
};

export type SkillDisclosurePlan = {
  primarySkillId?: string;
  includeBody: boolean;
  availableResources: SkillResource[];
  disclosedResourceUris: string[];
};

export type SkillContext = {
  primary?: {
    id: string;
    version: string;
    name: string;
    body: string;
  };
  resources: SkillResource[];
  disclosedResources: Array<{
    uri: string;
    content: string;
  }>;
  match?: {
    source: SkillMatchSource;
    reason: string;
    score: number;
    secondarySkillIds: string[];
  };
};
