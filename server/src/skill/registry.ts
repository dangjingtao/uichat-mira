import type {
  SkillActivationContext,
  SkillDefinition,
  SkillRegistration,
} from "./types";

const registrations = new Map<string, SkillRegistration>();
const latestVersionBySkillId = new Map<string, string>();

const registrationKey = (skillId: string, version: string) => `${skillId}@${version}`;

export const registerSkill = (
  registration: SkillRegistration,
  options?: { replace?: boolean },
) => {
  const { id, version } = registration.definition;
  if (!id.trim()) {
    throw new Error("Skill definition id is required.");
  }
  if (!version.trim()) {
    throw new Error(`Skill ${id} version is required.`);
  }

  const key = registrationKey(id, version);
  if (registrations.has(key) && options?.replace !== true) {
    throw new Error(`Skill already registered: ${key}`);
  }

  registrations.set(key, registration);
  latestVersionBySkillId.set(id, version);
  return registration;
};

export const unregisterSkill = (skillId: string, version?: string) => {
  const resolvedVersion = version ?? latestVersionBySkillId.get(skillId);
  if (!resolvedVersion) {
    return false;
  }

  const deleted = registrations.delete(registrationKey(skillId, resolvedVersion));
  if (!deleted) {
    return false;
  }

  if (latestVersionBySkillId.get(skillId) === resolvedVersion) {
    const remainingVersions = [...registrations.values()]
      .filter((item) => item.definition.id === skillId)
      .map((item) => item.definition.version);
    const nextVersion = remainingVersions.at(-1);
    if (nextVersion) {
      latestVersionBySkillId.set(skillId, nextVersion);
    } else {
      latestVersionBySkillId.delete(skillId);
    }
  }

  return true;
};

export const getSkillRegistration = (skillId: string, version?: string) => {
  const resolvedVersion = version ?? latestVersionBySkillId.get(skillId);
  if (!resolvedVersion) {
    return undefined;
  }
  return registrations.get(registrationKey(skillId, resolvedVersion));
};

export const listSkillDefinitions = (): SkillDefinition[] =>
  [...latestVersionBySkillId.entries()]
    .map(([skillId, version]) => registrations.get(registrationKey(skillId, version)))
    .filter((item): item is SkillRegistration => Boolean(item))
    .map((item) => item.definition);

const toMatchScore = (value: boolean | number) => {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
};

export const resolveMatchingSkillRegistration = async (
  context: SkillActivationContext,
  options?: { excludedSkillIds?: string[] },
): Promise<SkillRegistration | undefined> => {
  const excluded = new Set(options?.excludedSkillIds ?? []);
  let best:
    | {
        registration: SkillRegistration;
        score: number;
      }
    | undefined;

  for (const definition of listSkillDefinitions()) {
    if (excluded.has(definition.id)) {
      continue;
    }
    const registration = getSkillRegistration(definition.id, definition.version);
    if (!registration?.match) {
      continue;
    }

    const score = toMatchScore(await registration.match(context));
    const threshold = Math.max(0, Math.min(1, registration.activationThreshold ?? 0.5));
    if (score < threshold) {
      continue;
    }
    if (!best || score > best.score) {
      best = { registration, score };
    }
  }

  return best?.registration;
};

export const clearSkillRegistryForTests = () => {
  registrations.clear();
  latestVersionBySkillId.clear();
};
