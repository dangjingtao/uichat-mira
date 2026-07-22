import type {
  SkillRegistration,
  SkillResolverContext,
} from "./types";

const registrationKey = (skillId: string, version: string) => `${skillId}@${version}`;

export class SkillRegistry {
  private readonly registrations = new Map<string, SkillRegistration>();

  register(registration: SkillRegistration) {
    const key = registrationKey(
      registration.definition.id,
      registration.definition.version,
    );
    this.registrations.set(key, registration);
    return registration;
  }

  get(skillId: string, version?: string) {
    if (version) {
      return this.registrations.get(registrationKey(skillId, version));
    }

    return [...this.registrations.values()]
      .filter((registration) => registration.definition.id === skillId)
      .sort((left, right) =>
        right.definition.version.localeCompare(left.definition.version, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )[0];
  }

  listAvailable() {
    return [...this.registrations.values()];
  }

  resolve(context: SkillResolverContext) {
    const explicitSkillId =
      typeof context.params?.skillId === "string"
        ? context.params.skillId.trim()
        : "";
    const explicitSkillVersion =
      typeof context.params?.skillVersion === "string"
        ? context.params.skillVersion.trim()
        : "";

    if (explicitSkillId) {
      return this.get(
        explicitSkillId,
        explicitSkillVersion || undefined,
      );
    }

    let best:
      | {
          registration: SkillRegistration;
          score: number;
        }
      | undefined;

    for (const registration of this.registrations.values()) {
      if (!registration.match) {
        continue;
      }
      const score = registration.match(context);
      if (!Number.isFinite(score) || score <= 0) {
        continue;
      }
      if (!best || score > best.score) {
        best = { registration, score };
      }
    }

    return best?.registration;
  }

  clear() {
    this.registrations.clear();
  }
}

export const skillRegistry = new SkillRegistry();

export const registerSkill = (registration: SkillRegistration) =>
  skillRegistry.register(registration);
