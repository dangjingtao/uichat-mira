import {
  getRoleModelConfigs,
  type RoleModelConfig,
  type RoleModelType,
} from "@/shared/api/modelSettings";

export type GlobalModelAccessStatus = {
  llmConnected: boolean;
  embeddingConnected: boolean;
  rerankConnected: boolean;
};

function isRoleConnected(config: RoleModelConfig | undefined) {
  return Boolean(config?.providerCode && config?.remoteModelId);
}

export function resolveGlobalModelAccessStatus(
  configs: RoleModelConfig[],
): GlobalModelAccessStatus {
  const byType = new Map<RoleModelType, RoleModelConfig>();

  for (const config of configs) {
    byType.set(config.type, config);
  }

  return {
    llmConnected: isRoleConnected(byType.get("llm")),
    embeddingConnected: isRoleConnected(byType.get("embedding")),
    rerankConnected: isRoleConnected(byType.get("rerank")),
  };
}

export async function getGlobalModelAccessStatus(): Promise<GlobalModelAccessStatus> {
  const configs = await getRoleModelConfigs();
  return resolveGlobalModelAccessStatus(configs);
}
