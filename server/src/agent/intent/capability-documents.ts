import type { HarnessCapabilityProfile } from "@/mcp/harness/capability-profiles.js";
import type { CapabilityIntentDocument } from "./types.js";

const toCompactJson = (value: unknown) => {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
};

export const toCapabilityIntentDocument = (
  profile: HarnessCapabilityProfile,
): CapabilityIntentDocument => {
  const supportingToolsText = toCompactJson(profile.supportingToolIds);
  const text = [
    profile.title,
    profile.id,
    profile.description,
    profile.domain,
    profile.tags.join(" "),
    profile.preferredToolId,
    supportingToolsText,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .join("\n");

  return {
    capabilityId: profile.id,
    title: profile.title,
    text,
    source: profile.source,
    domain: profile.domain,
    tags: profile.tags,
  };
};

export const toCapabilityIntentDocuments = (
  profiles: HarnessCapabilityProfile[],
): CapabilityIntentDocument[] =>
  profiles.map(toCapabilityIntentDocument);
