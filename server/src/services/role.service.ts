import { roleRepository } from "@/db/repositories";
import type { Role, RoleStatus } from "@/db/schema";

export interface RolePromptResponse {
  description: string;
  worldview: string;
  persona: string;
  scenario: string;
  exampleDialogues: string;
  style: string;
  constraints: string;
}

export interface RoleLlmProfileResponse {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface RoleResponse {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RolePromptResponse;
  llmProfile: RoleLlmProfileResponse;
  createdAt: string;
  updatedAt: string;
}

export interface RoleListInput {
  userId: number;
  status?: RoleStatus;
  sortBy?: "createdAt" | "updatedAt" | "name";
  sortOrder?: "asc" | "desc";
}

export interface RoleMutationInput {
  name?: string;
  summary?: string;
  avatarId?: string | null;
  status?: RoleStatus;
  tags?: string[];
  prompt?: Partial<RolePromptResponse>;
  llmProfile?: Partial<RoleLlmProfileResponse>;
}

const DEFAULT_PROMPT: RolePromptResponse = {
  description: "",
  worldview: "",
  persona: "",
  scenario: "",
  exampleDialogues: "",
  style: "",
  constraints: "",
};

const parseStringArray = (value: string | null | undefined): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const parsePrompt = (value: string | null | undefined): RolePromptResponse => {
  if (!value) {
    return { ...DEFAULT_PROMPT };
  }

  try {
    const parsed = JSON.parse(value) as Partial<RolePromptResponse>;
    return {
      description:
        typeof parsed.description === "string" ? parsed.description : "",
      worldview: typeof parsed.worldview === "string" ? parsed.worldview : "",
      persona: typeof parsed.persona === "string" ? parsed.persona : "",
      scenario: typeof parsed.scenario === "string" ? parsed.scenario : "",
      exampleDialogues:
        typeof parsed.exampleDialogues === "string"
          ? parsed.exampleDialogues
          : "",
      style: typeof parsed.style === "string" ? parsed.style : "",
      constraints:
        typeof parsed.constraints === "string" ? parsed.constraints : "",
    };
  } catch {
    return { ...DEFAULT_PROMPT };
  }
};

const normalizeTags = (tags: string[] | undefined) =>
  (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);

const normalizePrompt = (prompt: Partial<RolePromptResponse> | undefined) => {
  const nextPrompt = {
    ...DEFAULT_PROMPT,
    ...(prompt ?? {}),
  };

  return {
    description: nextPrompt.description.trim(),
    worldview: nextPrompt.worldview.trim(),
    persona: nextPrompt.persona.trim(),
    scenario: nextPrompt.scenario.trim(),
    exampleDialogues: nextPrompt.exampleDialogues.trim(),
    style: nextPrompt.style.trim(),
    constraints: nextPrompt.constraints.trim(),
  };
};

const sanitizeRoleLlmProfile = (
  profile: Partial<RoleLlmProfileResponse> | undefined,
): RoleLlmProfileResponse => {
  const nextProfile = profile ?? {};
  const sanitized: RoleLlmProfileResponse = {};

  if (typeof nextProfile.temperature === "number") {
    sanitized.temperature = nextProfile.temperature;
  }
  if (typeof nextProfile.topP === "number") {
    sanitized.topP = nextProfile.topP;
  }
  if (typeof nextProfile.topK === "number") {
    sanitized.topK = nextProfile.topK;
  }
  if (typeof nextProfile.maxTokens === "number") {
    sanitized.maxTokens = nextProfile.maxTokens;
  }
  if (typeof nextProfile.frequencyPenalty === "number") {
    sanitized.frequencyPenalty = nextProfile.frequencyPenalty;
  }
  if (typeof nextProfile.presencePenalty === "number") {
    sanitized.presencePenalty = nextProfile.presencePenalty;
  }

  return sanitized;
};

const parseLlmProfile = (
  value: string | null | undefined,
): RoleLlmProfileResponse => {
  if (!value) {
    return {};
  }

  try {
    return sanitizeRoleLlmProfile(
      JSON.parse(value) as Partial<RoleLlmProfileResponse>,
    );
  } catch {
    return {};
  }
};

const toRoleResponse = (role: Role): RoleResponse => ({
  id: role.id,
  name: role.name,
  summary: role.summary,
  avatarId: role.avatarId ?? null,
  status: role.status,
  tags: parseStringArray(role.tagsJson),
  prompt: parsePrompt(role.promptJson),
  llmProfile: parseLlmProfile(role.llmProfileJson),
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
});

export const roleService = {
  listRoles(input: RoleListInput): RoleResponse[] {
    return roleRepository.list(input).map(toRoleResponse);
  },

  getRoleById(id: string, userId: number): RoleResponse | null {
    const role = roleRepository.findById(id, userId);
    return role ? toRoleResponse(role) : null;
  },

  createRole(input: RoleMutationInput & { userId: number }): RoleResponse {
    const created = roleRepository.create({
      userId: input.userId,
      name: input.name?.trim() || "Untitled Role",
      summary: input.summary?.trim() || "",
      avatarId: input.avatarId ?? null,
      status: input.status ?? "draft",
      tagsJson: JSON.stringify(normalizeTags(input.tags)),
      promptJson: JSON.stringify(normalizePrompt(input.prompt)),
      llmProfileJson: JSON.stringify(sanitizeRoleLlmProfile(input.llmProfile)),
    });

    return toRoleResponse(created);
  },

  updateRole(
    id: string,
    userId: number,
    input: RoleMutationInput,
  ): RoleResponse | null {
    const existing = roleRepository.findById(id, userId);
    if (!existing) {
      return null;
    }

    const existingPrompt = parsePrompt(existing.promptJson);
    const existingLlmProfile = parseLlmProfile(existing.llmProfileJson);
    const updated = roleRepository.updateById(id, {
      ...(input.name !== undefined ? { name: input.name.trim() || existing.name } : {}),
      ...(input.summary !== undefined ? { summary: input.summary.trim() } : {}),
      ...(input.avatarId !== undefined ? { avatarId: input.avatarId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.tags !== undefined
        ? { tagsJson: JSON.stringify(normalizeTags(input.tags)) }
        : {}),
      ...(input.prompt !== undefined
        ? {
            promptJson: JSON.stringify(
              normalizePrompt({
                ...existingPrompt,
                ...input.prompt,
              }),
            ),
          }
        : {}),
      ...(input.llmProfile !== undefined
        ? {
            llmProfileJson: JSON.stringify(
              sanitizeRoleLlmProfile({
                ...existingLlmProfile,
                ...input.llmProfile,
              }),
            ),
          }
        : {}),
    });

    return updated ? toRoleResponse(updated) : null;
  },

  deleteRole(id: string, userId: number): boolean {
    const existing = roleRepository.findById(id, userId);
    if (!existing) {
      return false;
    }

    return roleRepository.deleteById(id);
  },
};
