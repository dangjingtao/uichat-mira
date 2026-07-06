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

export function hasConfiguredProviderBinding(
  config: RoleModelConfig | null | undefined,
) {
  return Boolean(
    config?.remoteModelId &&
      (config.providerConnectionId || config.providerCode),
  );
}

export function resolveGlobalModelAccessStatus(
  configs: RoleModelConfig[],
): GlobalModelAccessStatus {
  const byType = new Map<RoleModelType, RoleModelConfig>();

  for (const config of configs) {
    byType.set(config.type, config);
  }

  return {
    llmConnected: hasConfiguredProviderBinding(byType.get("llm")),
    embeddingConnected: hasConfiguredProviderBinding(byType.get("embedding")),
    rerankConnected: hasConfiguredProviderBinding(byType.get("rerank")),
  };
}

export async function getGlobalModelAccessStatus(): Promise<GlobalModelAccessStatus> {
  const configs = await getRoleModelConfigs();
  return resolveGlobalModelAccessStatus(configs);
}
