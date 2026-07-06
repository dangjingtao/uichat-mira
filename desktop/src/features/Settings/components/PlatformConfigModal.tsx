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
  const [selectedProviderId, setSelectedProviderId] =
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

  const getErrorMessage = useCallback(
    (err: unknown, fallbackKey: string) => {
      if (err instanceof Error) {
        if (
          err.name === "AbortError" ||
          err.message === "This operation was aborted"
        ) {
          return t("settings.model.platformConfig.requestAborted");
        }

        return err.message;
      }

      return t(fallbackKey);
    },
    [t],
  );

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
          nextProviders.find((item) => item.code === selectedProviderId)?.code ??
          nextProviders[0]?.code ??
          DEFAULT_PROVIDER_CODE;
        setSelectedProviderId(initialProvider);
        await loadProviderDetail(initialProvider);
      } catch (err) {
        const messageText = getErrorMessage(
          err,
          "settings.model.platformConfig.loadFailed",
        );
        message.error(messageText);
      }
    })();
  }, [
    getErrorMessage,
    loadProviderDetail,
    loadProviders,
    selectedProviderId,
  ]);

  const currentDetail = providerDetails[selectedProviderId] ?? null;
  const currentSelectedModelId = selectedModelIds[selectedProviderId] ?? "";

  const handleSelectProvider = async (providerId: string) => {
    const nextCode = providerId as ProviderCode;
    setSelectedProviderId(nextCode);

    if (!providerDetails[nextCode]) {
      try {
        await loadProviderDetail(nextCode);
      } catch (err) {
        const messageText = getErrorMessage(
          err,
          "settings.model.platformConfig.loadDetailFailed",
        );
        message.error(messageText);
      }
    }
  };

  const updateCurrentDetail = (patch: Partial<ProviderDetail["provider"]>) => {
    setProviderDetails((prev) => {
      const detail = prev[selectedProviderId];
      if (!detail) {
        return prev;
      }

      return {
        ...prev,
        [selectedProviderId]: {
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
      setSyncErrorByProvider((prev) => ({ ...prev, [selectedProviderId]: null }));
      await saveProviderConfig(selectedProviderId, {
        displayName: currentDetail.provider.displayName,
        baseUrl: currentDetail.provider.baseUrl,
        apiKey: currentDetail.provider.apiKey,
      });
      await syncProviderModels(selectedProviderId);
      await loadProviders();
      await loadProviderDetail(selectedProviderId);
      message.success(t("settings.model.platformConfig.syncSuccess"));
    } catch (err) {
      const messageText = getErrorMessage(
        err,
        "settings.model.platformConfig.syncFailed",
      );
      setSyncErrorByProvider((prev) => ({
        ...prev,
        [selectedProviderId]: messageText,
      }));
      setSelectedModelIds((prev) => ({
        ...prev,
        [selectedProviderId]: "",
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
      await selectProviderRoleModel(
        selectedProviderId,
        role,
        currentSelectedModelId,
        {
          baseUrl: currentDetail?.provider.baseUrl ?? "",
          apiKey: currentDetail?.provider.apiKey ?? "",
        },
      );
      await loadProviders();
      await loadProviderDetail(selectedProviderId);
      await refreshRoleModelConfigs();
      broadcastRoleModelConfigChanged();
      await onRoleConfigUpdated?.();
      message.success(
        role === "evaluation"
          ? t("settings.model.platformConfig.updatedEvaluation")
          : t("settings.model.platformConfig.updatedDefault", { role: role.toUpperCase() }),
      );
    } catch (err) {
      const messageText = getErrorMessage(
        err,
        "settings.model.platformConfig.setDefaultFailed",
      );
      message.error(messageText);
    } finally {
      setAssigningRole(null);
    }
  };

  const providerGroups = useMemo(
    () => [
      {
        id: "builtin",
        titleKey: "settings.model.connections.builtinGroupTitle",
        descriptionKey: "settings.model.connections.builtinGroupDescription",
        items: providers.filter((item) => item.isSystem),
      },
      {
        id: "custom",
        titleKey: "settings.model.connections.customGroupTitle",
        descriptionKey: "settings.model.connections.customGroupDescription",
        items: providers.filter((item) => !item.isSystem),
      },
    ],
    [providers],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:flex-row">
        <div className="w-full shrink-0 lg:w-72">
          <div className="flex h-full flex-col rounded-2xl border border-border bg-surface-secondary/40 p-3">
            <div className="mb-3">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                {t("settings.model.connections.sidebarTitle")}
              </div>
              <div className="mt-1 text-xs leading-5 text-text-secondary">
                {t("settings.model.connections.sidebarDescription")}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto">
              {providerGroups.map((group) => (
                <section key={group.id} className="space-y-2">
                  <div className="px-1">
                    <div className="text-xs font-semibold text-text-primary">
                      {t(group.titleKey)}
                    </div>
                    <div className="text-[11px] leading-4 text-text-secondary">
                      {t(group.descriptionKey)}
                    </div>
                  </div>

                  {group.items.length > 0 ? (
                    <div className="space-y-1">
                      {group.items.map((provider) => {
                        const isSelected = selectedProviderId === provider.code;
                        const isLoading = loadingProviderId === provider.code;
                        const statusTone =
                          provider.status === "connected"
                            ? "bg-success/10 text-success"
                            : provider.status === "error"
                              ? "bg-danger/10 text-danger"
                              : "bg-surface-tertiary text-text-secondary";

                        return (
                          <button
                            key={provider.code}
                            type="button"
                            onClick={() => void handleSelectProvider(provider.code)}
                            className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                              isSelected
                                ? "border-primary/30 bg-surface-primary shadow-shadow-sm"
                                : "border-transparent bg-transparent hover:border-border hover:bg-surface-primary"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-medium text-text-primary">
                                    {provider.displayName}
                                  </span>
                                  <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                                    {provider.templateCode}
                                  </span>
                                </div>
                                <div className="text-[11px] leading-4 text-text-secondary">
                                  {provider.assignedRoles.length > 0
                                    ? t("settings.model.connections.boundSummary", {
                                        roles: provider.assignedRoles.join(" / "),
                                      })
                                    : t("settings.model.connections.unassignedSummary")}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col items-end gap-1">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusTone}`}>
                                  {t(`settings.model.status.${provider.status}`)}
                                </span>
                                {isLoading ? (
                                  <span className="text-[10px] text-text-tertiary">
                                    {t("settings.model.connections.loading")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-secondary">
                      {t("settings.model.connections.emptyGroup")}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </div>
        </div>

        <ApiConfigCard
          detail={currentDetail}
          selectedModelId={currentSelectedModelId}
          loading={loadingProviderId === selectedProviderId}
          syncing={syncing}
          assigningRole={assigningRole}
          syncError={syncErrorByProvider[selectedProviderId] ?? null}
          onDisplayNameChange={(displayName) =>
            updateCurrentDetail({ displayName })
          }
          onApiKeyChange={(apiKey) => updateCurrentDetail({ apiKey })}
          onApiUrlChange={(baseUrl) => updateCurrentDetail({ baseUrl })}
          onSelectedModelChange={(value) =>
            setSelectedModelIds((prev) => ({
              ...prev,
              [selectedProviderId]: value,
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
