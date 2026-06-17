import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getProviderDetail,
  getProviders,
  saveProviderConfig,
  selectProviderRoleModel,
  syncProviderModels,
  type ProviderCode,
  type ProviderDetail,
  type ProviderSummary,
  type RoleModelType,
} from "@/shared/api/modelSettings";
import { DEFAULT_PROVIDER_CODE } from "@/shared/providerCatalog";
import { message } from "@/shared/ui/Message";
import ApiConfigCard from "./ApiConfigCard";
import PlatformCard from "./PlatformCard";
import {
  broadcastRoleModelConfigChanged,
  useRoleModelConfigs,
} from "@/app/providers/RoleModelConfigProvider";

interface PlatformConfigModalProps {
  onRoleConfigUpdated?: () => void | Promise<void>;
}

const PlatformConfigModal: React.FC<PlatformConfigModalProps> = ({
  onRoleConfigUpdated,
}) => {
  const { t } = useTranslation();
  const { refresh: refreshRoleModelConfigs } = useRoleModelConfigs();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [selectedProviderCode, setSelectedProviderCode] =
    useState<ProviderCode>(DEFAULT_PROVIDER_CODE);
  const [providerDetails, setProviderDetails] = useState<
    Partial<Record<ProviderCode, ProviderDetail>>
  >({});
  const [selectedModelIds, setSelectedModelIds] = useState<
    Partial<Record<ProviderCode, string>>
  >({});
  const [loadingProviderId, setLoadingProviderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [assigningRole, setAssigningRole] = useState<RoleModelType | null>(null);
  const [syncErrorByProvider, setSyncErrorByProvider] = useState<
    Partial<Record<ProviderCode, string | null>>
  >({});

  const loadProviders = useCallback(async () => {
    const nextProviders = await getProviders();
    setProviders(nextProviders);
    return nextProviders;
  }, []);

  const loadProviderDetail = useCallback(async (providerCode: ProviderCode) => {
    setLoadingProviderId(providerCode);

    try {
      const detail = await getProviderDetail(providerCode);
      setProviderDetails((prev) => ({ ...prev, [providerCode]: detail }));
      setSyncErrorByProvider((prev) => ({ ...prev, [providerCode]: null }));
      setSelectedModelIds((prev) => ({
        ...prev,
        [providerCode]:
          prev[providerCode] ||
          detail.assignments.llm?.remoteModelId ||
          detail.models[0]?.id ||
          "",
      }));
    } finally {
      setLoadingProviderId(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const nextProviders = await loadProviders();
        const initialProvider =
          nextProviders.find((item) => item.code === selectedProviderCode)?.code ??
          nextProviders[0]?.code ??
          DEFAULT_PROVIDER_CODE;
        setSelectedProviderCode(initialProvider);
        await loadProviderDetail(initialProvider);
      } catch (err) {
        const messageText = err instanceof Error ? err.message : t("settings.model.platformConfig.loadFailed");
        message.error(messageText);
      }
    })();
  }, [loadProviderDetail, loadProviders, selectedProviderCode, t]);

  const currentDetail = providerDetails[selectedProviderCode] ?? null;
  const currentSelectedModelId = selectedModelIds[selectedProviderCode] ?? "";

  const handleSelectProvider = async (providerCode: string) => {
    const nextCode = providerCode as ProviderCode;
    setSelectedProviderCode(nextCode);

    if (!providerDetails[nextCode]) {
      try {
        await loadProviderDetail(nextCode);
      } catch (err) {
        const messageText =
          err instanceof Error ? err.message : t("settings.model.platformConfig.loadDetailFailed");
        message.error(messageText);
      }
    }
  };

  const updateCurrentDetail = (patch: Partial<ProviderDetail["provider"]>) => {
    setProviderDetails((prev) => {
      const detail = prev[selectedProviderCode];
      if (!detail) {
        return prev;
      }

      return {
        ...prev,
        [selectedProviderCode]: {
          ...detail,
          provider: {
            ...detail.provider,
            ...patch,
          },
        },
      };
    });
  };

  const handleSyncModels = async () => {
    if (!currentDetail) {
      return;
    }

    setSyncing(true);
    try {
      setSyncErrorByProvider((prev) => ({ ...prev, [selectedProviderCode]: null }));
      await saveProviderConfig(selectedProviderCode, {
        baseUrl: currentDetail.provider.baseUrl,
        apiKey: currentDetail.provider.apiKey,
      });
      await syncProviderModels(selectedProviderCode);
      await loadProviders();
      await loadProviderDetail(selectedProviderCode);
      message.success(t("settings.model.platformConfig.syncSuccess"));
    } catch (err) {
      const messageText = err instanceof Error ? err.message : t("settings.model.platformConfig.syncFailed");
      setSyncErrorByProvider((prev) => ({
        ...prev,
        [selectedProviderCode]: messageText,
      }));
      setSelectedModelIds((prev) => ({
        ...prev,
        [selectedProviderCode]: "",
      }));
      message.error(messageText);
    } finally {
      setSyncing(false);
    }
  };

  const handleSetDefaultRole = async (role: RoleModelType) => {
    if (!currentSelectedModelId) {
      message.warning(t("settings.model.platformConfig.selectModelFirst"));
      return;
    }

    setAssigningRole(role);
    try {
      await saveProviderConfig(selectedProviderCode, {
        baseUrl: currentDetail?.provider.baseUrl ?? "",
        apiKey: currentDetail?.provider.apiKey ?? "",
      });
      await selectProviderRoleModel(
        selectedProviderCode,
        role,
        currentSelectedModelId,
      );
      await loadProviders();
      await loadProviderDetail(selectedProviderCode);
      await refreshRoleModelConfigs();
      broadcastRoleModelConfigChanged();
      await onRoleConfigUpdated?.();
      message.success(
        role === "evaluation"
          ? t("settings.model.platformConfig.updatedEvaluation")
          : t("settings.model.platformConfig.updatedDefault", { role: role.toUpperCase() }),
      );
    } catch (err) {
      const messageText = err instanceof Error ? err.message : t("settings.model.platformConfig.setDefaultFailed");
      message.error(messageText);
    } finally {
      setAssigningRole(null);
    }
  };

  const sortedProviders = useMemo(() => providers, [providers]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
        <PlatformCard
          platforms={sortedProviders}
          selectedPlatform={selectedProviderCode}
          loadingPlatformId={loadingProviderId}
          onSelectPlatform={handleSelectProvider}
        />

        <ApiConfigCard
          detail={currentDetail}
          selectedModelId={currentSelectedModelId}
          loading={loadingProviderId === selectedProviderCode}
          syncing={syncing}
          assigningRole={assigningRole}
          syncError={syncErrorByProvider[selectedProviderCode] ?? null}
          onApiKeyChange={(apiKey) => updateCurrentDetail({ apiKey })}
          onApiUrlChange={(baseUrl) => updateCurrentDetail({ baseUrl })}
          onSelectedModelChange={(value) =>
            setSelectedModelIds((prev) => ({
              ...prev,
              [selectedProviderCode]: value,
            }))
          }
          onTestConnection={handleSyncModels}
          onSetDefaultRole={handleSetDefaultRole}
        />
      </div>
    </div>
  );
};

export default PlatformConfigModal;
