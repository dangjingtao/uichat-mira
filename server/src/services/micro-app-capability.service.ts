import {
  microAppCapabilityBindingsRepository,
  type MicroAppCapabilityCode,
  type MicroAppProviderId,
} from "@/db/repositories";

const capabilityMicroApps: Record<MicroAppCapabilityCode, string> = {
  imageGeneration: "image_generation",
  tts: "tts",
};

const providerOptions: Record<MicroAppCapabilityCode, readonly MicroAppProviderId[]> = {
  imageGeneration: ["api_provider", "comfyui_local"],
  tts: ["piper_local", "gpt_sovits", "api_provider"],
};

const providerLabels: Record<MicroAppProviderId, string> = {
  api_provider: "API服务商",
  comfyui_local: "ComfyUI",
  piper_local: "Piper",
  gpt_sovits: "GPT-SoVITS",
};

const toResponse = (row: ReturnType<typeof microAppCapabilityBindingsRepository.get>) => {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    microAppCode: row.microAppCode,
    capabilityCode: row.capabilityCode,
    providerId: row.providerId as MicroAppProviderId,
    providerDisplayName: providerLabels[row.providerId as MicroAppProviderId] ?? row.providerId,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

export const microAppCapabilityService = {
  list() {
    return microAppCapabilityBindingsRepository
      .list()
      .map((row) => toResponse(row))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
  },

  get(capabilityCode: MicroAppCapabilityCode) {
    return toResponse(
      microAppCapabilityBindingsRepository.get(
        capabilityMicroApps[capabilityCode],
        capabilityCode,
      ),
    );
  },

  save(input: {
    capabilityCode: MicroAppCapabilityCode;
    providerId: MicroAppProviderId;
  }) {
    if (!providerOptions[input.capabilityCode].includes(input.providerId)) {
      throw new Error(
        `服务商 ${input.providerId} 不支持能力 ${input.capabilityCode}。`,
      );
    }

    const row = microAppCapabilityBindingsRepository.upsert({
      microAppCode: capabilityMicroApps[input.capabilityCode],
      capabilityCode: input.capabilityCode,
      providerId: input.providerId,
    });
    return toResponse(row);
  },
};
