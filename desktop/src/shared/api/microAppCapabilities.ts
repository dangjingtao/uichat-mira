import { get, put } from "@/shared/lib/request";

export type MicroAppCapabilityCode = "imageGeneration" | "tts";
export type MicroAppProviderId =
  | "api_provider"
  | "comfyui_local"
  | "piper_local"
  | "gpt_sovits";

export type MicroAppCapabilityBinding = {
  id: string;
  microAppCode: string;
  capabilityCode: MicroAppCapabilityCode;
  providerId: MicroAppProviderId;
  providerDisplayName: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export async function getMicroAppCapabilities() {
  return get<MicroAppCapabilityBinding[]>("/microapps/capabilities");
}

export async function saveMicroAppCapability(
  capabilityCode: MicroAppCapabilityCode,
  payload: { providerId: MicroAppProviderId },
) {
  return put<MicroAppCapabilityBinding>(
    `/microapps/capabilities/${encodeURIComponent(capabilityCode)}`,
    payload,
  );
}
