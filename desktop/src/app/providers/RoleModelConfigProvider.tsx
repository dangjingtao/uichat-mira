import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import {
  getRoleModelConfigs,
  type RoleModelConfig,
  type RoleModelType,
} from "@/shared/api/modelSettings";
import {
  hasConfiguredProviderBinding,
  resolveGlobalModelAccessStatus,
  type GlobalModelAccessStatus,
} from "@/shared/business/modelAccess";

type RoleModelConfigMap = Record<RoleModelType, RoleModelConfig | null>;

type RoleModelConfigContextValue = {
  configs: RoleModelConfig[];
  configMap: RoleModelConfigMap;
  modelAccessStatus: GlobalModelAccessStatus;
  loading: boolean;
  loaded: boolean;
  errorMessage: string;
  hasDefaultLlm: boolean;
  hasDefaultEmbedding: boolean;
  refresh: () => Promise<RoleModelConfig[]>;
};

const emptyConfigMap: RoleModelConfigMap = {
  llm: null,
  embedding: null,
  rerank: null,
  task: null,
  agentTask: null,
  evaluation: null,
  imageGeneration: null,
  voice: null,
};

const disconnectedModelAccessStatus: GlobalModelAccessStatus = {
  llmConnected: false,
  embeddingConnected: false,
  rerankConnected: false,
};

const RoleModelConfigContext =
  createContext<RoleModelConfigContextValue | null>(null);

const ROLE_MODEL_CONFIG_CHANGED_EVENT = "role-model-config-changed";

function hasConfiguredRoleModel(
  config: RoleModelConfig | null | undefined,
): boolean {
  return hasConfiguredProviderBinding(config);
}

function buildConfigMap(configs: RoleModelConfig[]): RoleModelConfigMap {
  const nextMap = { ...emptyConfigMap };

  for (const config of configs) {
    nextMap[config.type] = config;
  }

  return nextMap;
}

/**
 * RoleModelConfigProvider caches default model assignments for chat/runtime
 * gating and settings display.
 *
 * Risk note:
 * Chat send availability, RAG gating and provider-specific transport behavior
 * all read from this provider. Treat it as shared runtime state, not a purely
 * settings-page concern.
 */
export function RoleModelConfigProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();
  const [configs, setConfigs] = useState<RoleModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!session?.token) {
      setConfigs([]);
      setLoading(false);
      setLoaded(false);
      setErrorMessage("");
      return [];
    }

    setLoading(true);

    try {
      const nextConfigs = await getRoleModelConfigs();
      setConfigs(nextConfigs);
      setLoaded(true);
      setErrorMessage("");
      return nextConfigs;
    } catch (error) {
      setConfigs([]);
      setLoaded(true);
      setErrorMessage(
        error instanceof Error ? error.message : "加载模型配置失败",
      );
      throw error;
    } finally {
      setLoading(false);
    }
  }, [session?.token]);

  useEffect(() => {
    if (!session?.token) {
      setConfigs([]);
      setLoading(false);
      setLoaded(false);
      setErrorMessage("");
      return;
    }

    void refresh();
  }, [refresh, session?.token]);

  useEffect(() => {
    const handleConfigChanged = () => {
      if (!session?.token) {
        return;
      }

      void refresh();
    };

    window.addEventListener(
      ROLE_MODEL_CONFIG_CHANGED_EVENT,
      handleConfigChanged,
    );

    return () => {
      window.removeEventListener(
        ROLE_MODEL_CONFIG_CHANGED_EVENT,
        handleConfigChanged,
      );
    };
  }, [refresh, session?.token]);

  const configMap = useMemo(() => buildConfigMap(configs), [configs]);
  const modelAccessStatus = useMemo(
    () =>
      loaded
        ? resolveGlobalModelAccessStatus(configs)
        : disconnectedModelAccessStatus,
    [configs, loaded],
  );

  const value = useMemo<RoleModelConfigContextValue>(
    () => ({
      configs,
      configMap,
      modelAccessStatus,
      loading,
      loaded,
      errorMessage,
      hasDefaultLlm: hasConfiguredRoleModel(configMap.llm),
      hasDefaultEmbedding: hasConfiguredRoleModel(configMap.embedding),
      refresh,
    }),
    [
      configs,
      configMap,
      modelAccessStatus,
      loading,
      loaded,
      errorMessage,
      refresh,
    ],
  );

  return (
    <RoleModelConfigContext.Provider value={value}>
      {children}
    </RoleModelConfigContext.Provider>
  );
}

export function useRoleModelConfigs() {
  const context = useContext(RoleModelConfigContext);

  if (!context) {
    throw new Error(
      "useRoleModelConfigs must be used within RoleModelConfigProvider",
    );
  }

  return context;
}

export function broadcastRoleModelConfigChanged() {
  window.dispatchEvent(new Event(ROLE_MODEL_CONFIG_CHANGED_EVENT));
}
