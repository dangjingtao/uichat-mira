import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  createProviderConnection,
  deleteProviderConnection,
  getProviderDetail,
  getProviders,
  getProviderTemplates,
  saveProviderConfig,
  selectProviderRoleModel,
  syncProviderModels,
  type ProviderCode,
  type ProviderDetail,
  type ProviderSummary,
  type ProviderTemplateSummary,
  type RoleModelType,
} from "@/shared/api/modelSettings";
import { DEFAULT_PROVIDER_CODE } from "@/shared/providerCatalog";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import { Button } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";
import ApiConfigCard from "./ApiConfigCard";
import PlatformCard from "./PlatformCard";
import {
  broadcastRoleModelConfigChanged,
  useRoleModelConfigs,
} from "@/app/providers/RoleModelConfigProvider";

const ROLE_UPDATED_MESSAGE_KEY: Record<RoleModelType, string> = {
  llm: "settings.model.api.updatedLlm",
  task: "settings.model.api.updatedTask",
  agentTask: "settings.model.api.updatedAgentTask",
  evaluation: "settings.model.api.updatedEvaluation",
  embedding: "settings.model.api.updatedEmbedding",
  rerank: "settings.model.api.updatedRerank",
  imageGeneration: "settings.model.api.updatedImageGeneration",
  voice: "settings.model.api.updatedVoice",
};

interface PlatformConfigModalProps {
  onRoleConfigUpdated?: () => void | Promise<void>;
  selectionRole?: RoleModelType;
  onSelectionStateChange?: (state: {
    canConfirm: boolean;
    confirming: boolean;
  }) => void;
}

export interface PlatformConfigModalRef {
  confirmSelection: () => Promise<boolean>;
  openCreateProviderDialog: () => void;
}

const CUSTOM_PROVIDER_TEMPLATE_CODE = "openai-compatible-custom";
const FALLBACK_CUSTOM_PROVIDER_BASE_URL = "https://api.example.com/v1";
const MODEL_NAME_DRAFTS_STORAGE_KEY = "rag-demo-model-name-drafts";

type StoredModelNameDraftMap = Record<string, string>;

function buildModelNameDraftStorageKey(
  role: RoleModelType,
  providerCode: ProviderCode,
) {
  return `${role}::${providerCode}`;
}

function readStoredModelNameDrafts(): StoredModelNameDraftMap {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) {
    return {};
  }

  try {
    const serialized = globalThis.localStorage.getItem(
      MODEL_NAME_DRAFTS_STORAGE_KEY,
    );
    if (!serialized) {
      return {};
    }

    const parsed = JSON.parse(serialized) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => {
        const [key, value] = entry;
        return typeof key === "string" && typeof value === "string";
      }),
    );
  } catch {
    return {};
  }
}

function writeStoredModelNameDraft(
  role: RoleModelType,
  providerCode: ProviderCode,
  modelName: string,
) {
  if (typeof globalThis === "undefined" || !globalThis.localStorage) {
    return;
  }

  const normalizedModelName = modelName.trim();

  try {
    const drafts = readStoredModelNameDrafts();
    const storageKey = buildModelNameDraftStorageKey(role, providerCode);

    if (normalizedModelName) {
      drafts[storageKey] = normalizedModelName;
    } else {
      delete drafts[storageKey];
    }

    globalThis.localStorage.setItem(
      MODEL_NAME_DRAFTS_STORAGE_KEY,
      JSON.stringify(drafts),
    );
  } catch {
    // Ignore storage write failures and keep the in-memory draft only.
  }
}

function readStoredModelNameDraft(
  role: RoleModelType,
  providerCode: ProviderCode,
) {
  const drafts = readStoredModelNameDrafts();
  return drafts[buildModelNameDraftStorageKey(role, providerCode)] ?? "";
}

interface CreateCustomProviderModalContentProps {
  defaultBaseUrl: string;
  creating: boolean;
  onCancel: () => void;
  onSubmit: (payload: {
    displayName: string;
    baseUrl: string;
    apiKey: string;
  }) => Promise<void>;
}

function CreateCustomProviderModalContent({
  defaultBaseUrl,
  creating,
  onCancel,
  onSubmit,
}: CreateCustomProviderModalContentProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      setNameError(t("settings.model.platform.createNameRequired"));
      return;
    }

    setNameError(null);
    await onSubmit({
      displayName: normalizedName,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
    });
  };

  return (
    <div className="space-y-3">
      <div className="text-sm text-text-secondary">
        {t("settings.model.platform.createDescription")}
      </div>

      <TextInput
        label={t("settings.model.api.displayName")}
        value={displayName}
        onChange={(value) => {
          setDisplayName(value);
          if (nameError) {
            setNameError(null);
          }
        }}
        placeholder={t("settings.model.platform.createNamePlaceholder")}
        error={nameError ?? undefined}
        compact
      />

      <TextInput
        label={t("settings.model.api.apiUrl")}
        value={baseUrl}
        onChange={setBaseUrl}
        placeholder={t("settings.model.api.apiUrlPlaceholder")}
        compact
      />

      <TextInput
        label={t("settings.model.api.apiKey")}
        type="password"
        value={apiKey}
        onChange={setApiKey}
        placeholder={t("settings.model.api.apiKeyPlaceholder")}
        compact
      />

      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={creating}>
          {t("common.actions.cancel")}
        </Button>
        <Button size="sm" onClick={() => void handleSubmit()} disabled={creating}>
          {creating
            ? t("settings.model.platform.creatingProvider")
            : t("settings.model.platform.createProvider")}
        </Button>
      </div>
    </div>
  );
}

const PlatformConfigModal = forwardRef<
  PlatformConfigModalRef,
  PlatformConfigModalProps
>(({ onRoleConfigUpdated, selectionRole, onSelectionStateChange }, ref) => {
  const { t } = useTranslation();
  const { configMap, refresh: refreshRoleModelConfigs } = useRoleModelConfigs();
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [providerTemplates, setProviderTemplates] = useState<
    ProviderTemplateSummary[]
  >([]);
  const [selectedProviderCode, setSelectedProviderCode] =
    useState<ProviderCode>(DEFAULT_PROVIDER_CODE);
  const [providerDetails, setProviderDetails] = useState<
    Partial<Record<ProviderCode, ProviderDetail>>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<
    Partial<Record<ProviderCode, string>>
  >({});
  const [currentModelNames, setCurrentModelNames] = useState<
    Partial<Record<ProviderCode, string>>
  >({});
  const [loadingProviderId, setLoadingProviderId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [assigningRole, setAssigningRole] = useState<RoleModelType | null>(null);
  const [creatingProvider, setCreatingProvider] = useState(false);
  const [deletingProvider, setDeletingProvider] = useState(false);
  const [syncErrorByProvider, setSyncErrorByProvider] = useState<
    Partial<Record<ProviderCode, string | null>>
  >({});
  const [hasResolvedInitialProvider, setHasResolvedInitialProvider] =
    useState(false);
  const activeSelectionRole = selectionRole ?? "llm";
  const preferredInitialProviderCode =
    selectionRole !== undefined
      ? ((configMap[selectionRole]?.providerConnectionId ??
          configMap[selectionRole]?.providerCode) as ProviderCode | null | undefined)
      : undefined;

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

  const loadProviderDetail = useCallback(
    async (providerCode: ProviderCode) => {
      setLoadingProviderId(providerCode);

      try {
        const detail = await getProviderDetail(providerCode);
        const storedModelNameDraft =
          readStoredModelNameDraft(activeSelectionRole, providerCode) || undefined;
        setProviderDetails((prev) => ({ ...prev, [providerCode]: detail }));
        setSyncErrorByProvider((prev) => ({ ...prev, [providerCode]: null }));
        setSelectedModelIds((prev) => ({
          ...prev,
          [providerCode]: (() => {
            const preferredModelId =
              prev[providerCode] ??
              storedModelNameDraft ??
              detail.assignments[activeSelectionRole]?.remoteModelId ??
              "";
            return detail.models.some((model) => model.id === preferredModelId)
              ? preferredModelId
              : "";
          })(),
        }));
        setCurrentModelNames((prev) => ({
          ...prev,
          [providerCode]:
            prev[providerCode] ??
            storedModelNameDraft ??
            detail.assignments[activeSelectionRole]?.remoteModelId ??
            "",
        }));
      } finally {
        setLoadingProviderId(null);
      }
    },
    [activeSelectionRole],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [nextProviders, nextTemplates] = await Promise.all([
          loadProviders(),
          getProviderTemplates(),
        ]);
        setProviderTemplates(nextTemplates);
        const availableProviders = selectionRole
          ? nextProviders.filter((provider) =>
              provider.capabilities.supportsRoles.includes(selectionRole),
            )
          : nextProviders;
        const initialProvider = !hasResolvedInitialProvider
          ? availableProviders.find(
              (item) => item.code === preferredInitialProviderCode,
            )
              ?.code ??
            availableProviders.find((item) => item.code === selectedProviderCode)
              ?.code ??
            availableProviders[0]?.code ??
            DEFAULT_PROVIDER_CODE
          : availableProviders.find((item) => item.code === selectedProviderCode)
              ?.code ??
            availableProviders[0]?.code ??
            DEFAULT_PROVIDER_CODE;
        setSelectedProviderCode(initialProvider);
        if (!hasResolvedInitialProvider) {
          setHasResolvedInitialProvider(true);
        }
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
    hasResolvedInitialProvider,
    loadProviderDetail,
    loadProviders,
    preferredInitialProviderCode,
    selectedProviderCode,
  ]);

  const filteredProviders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const roleProviders = selectionRole
      ? providers.filter((provider) =>
          provider.capabilities.supportsRoles.includes(selectionRole),
        )
      : providers;

    if (!normalizedQuery) return roleProviders;

    return roleProviders.filter((provider) =>
      [provider.displayName, provider.code, provider.baseUrl].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
    );
  }, [providers, searchQuery, selectionRole]);

  const customProviderTemplate = useMemo(
    () =>
      providerTemplates.find(
        (template) => template.code === CUSTOM_PROVIDER_TEMPLATE_CODE,
      ) ?? null,
    [providerTemplates],
  );

  const currentDetail = providerDetails[selectedProviderCode] ?? null;
  const currentSelectedModelId = selectedModelIds[selectedProviderCode] ?? "";
  const currentModelName = currentModelNames[selectedProviderCode] ?? "";
  const isConfirmingSelection =
    selectionRole !== undefined && assigningRole === selectionRole;
  const canConfirmSelection =
    selectionRole !== undefined &&
    Boolean(currentModelName.trim()) &&
    !syncing &&
    !loadingProviderId;

  const handleSelectProvider = async (providerCode: string) => {
    const nextCode = providerCode as ProviderCode;
    setSelectedProviderCode(nextCode);

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
      const messageText = getErrorMessage(
        err,
        "settings.model.platformConfig.syncFailed",
      );
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

  const handleSetDefaultRole = useCallback(async (role: RoleModelType) => {
    if (!currentModelName.trim()) {
      message.warning(t("settings.model.platformConfig.selectModelFirst"));
      return false;
    }

    setAssigningRole(role);
    try {
      await selectProviderRoleModel(
        selectedProviderCode,
        role,
        currentModelName.trim(),
        {
          baseUrl: currentDetail?.provider.baseUrl ?? "",
          apiKey: currentDetail?.provider.apiKey ?? "",
        },
      );
      await loadProviders();
      await loadProviderDetail(selectedProviderCode);
      await refreshRoleModelConfigs();
      broadcastRoleModelConfigChanged();
      await onRoleConfigUpdated?.();
      message.success(t(ROLE_UPDATED_MESSAGE_KEY[role]));
      return true;
    } catch (err) {
      const messageText = getErrorMessage(
        err,
        "settings.model.platformConfig.setDefaultFailed",
      );
      message.error(messageText);
      return false;
    } finally {
      setAssigningRole(null);
    }
  }, [
    currentDetail?.provider.apiKey,
    currentDetail?.provider.baseUrl,
    currentModelName,
    getErrorMessage,
    loadProviderDetail,
    loadProviders,
    onRoleConfigUpdated,
    refreshRoleModelConfigs,
    selectedProviderCode,
    t,
  ]);

  const handleCreateProvider = useCallback(
    async (payload: {
      displayName: string;
      baseUrl: string;
      apiKey: string;
    }) => {
      setCreatingProvider(true);
      try {
        const created = await createProviderConnection({
          templateCode: CUSTOM_PROVIDER_TEMPLATE_CODE,
          displayName: payload.displayName,
          baseUrl: payload.baseUrl,
          apiKey: payload.apiKey,
        });
        await loadProviders();
        setSelectedProviderCode(created.code);
        setSearchQuery("");
        await loadProviderDetail(created.code);
        message.success(t("settings.model.platform.createSuccess"));
      } catch (err) {
        const messageText = getErrorMessage(
          err,
          "settings.model.platform.createFailed",
        );
        message.error(messageText);
        throw err;
      } finally {
        setCreatingProvider(false);
      }
    },
    [getErrorMessage, loadProviderDetail, loadProviders, t],
  );

  const handleDeleteProvider = useCallback(() => {
    if (!currentDetail || currentDetail.provider.isSystem) {
      return;
    }

    const providerCode = currentDetail.provider.code;
    const providerName = currentDetail.provider.displayName;

    Modal.confirm({
      title: t("settings.model.platform.deleteTitle"),
      description: t("settings.model.platform.deleteDescription", {
        name: providerName,
      }),
      confirmText: t("settings.model.platform.deleteConfirm"),
      loadingText: t("settings.model.platform.deletingProvider"),
      tone: "danger",
      onConfirm: async () => {
        setDeletingProvider(true);
        try {
          await deleteProviderConnection(providerCode);

          setProviderDetails((prev) => {
            const next = { ...prev };
            delete next[providerCode];
            return next;
          });
          setSelectedModelIds((prev) => {
            const next = { ...prev };
            delete next[providerCode];
            return next;
          });
          setCurrentModelNames((prev) => {
            const next = { ...prev };
            delete next[providerCode];
            return next;
          });
          setSyncErrorByProvider((prev) => {
            const next = { ...prev };
            delete next[providerCode];
            return next;
          });

          const nextProviders = await loadProviders();
          const fallbackProviderCode =
            nextProviders.find((item) => item.code !== providerCode)?.code ??
            nextProviders[0]?.code ??
            DEFAULT_PROVIDER_CODE;

          setSelectedProviderCode(fallbackProviderCode);
          if (nextProviders.some((item) => item.code === fallbackProviderCode)) {
            await loadProviderDetail(fallbackProviderCode);
          }

          await refreshRoleModelConfigs();
          broadcastRoleModelConfigChanged();
          await onRoleConfigUpdated?.();
          message.success(t("settings.model.platform.deleteSuccess"));
        } catch (err) {
          const messageText = getErrorMessage(
            err,
            "settings.model.platform.deleteFailed",
          );
          message.error(messageText);
          throw err;
        } finally {
          setDeletingProvider(false);
        }
      },
    });
  }, [
    currentDetail,
    getErrorMessage,
    loadProviderDetail,
    loadProviders,
    onRoleConfigUpdated,
    refreshRoleModelConfigs,
    t,
  ]);

  const openCreateProviderDialog = useCallback(() => {
    let modalKey = "";

    modalKey = Modal.show({
      title: t("settings.model.platform.createTitle"),
      width: 520,
      footer: null,
      content: (
        <CreateCustomProviderModalContent
          defaultBaseUrl={
            customProviderTemplate?.defaultBaseUrl ??
            FALLBACK_CUSTOM_PROVIDER_BASE_URL
          }
          creating={creatingProvider}
          onCancel={() => Modal.close(modalKey)}
          onSubmit={async (payload) => {
            await handleCreateProvider(payload);
            Modal.close(modalKey);
          }}
        />
      ),
    });
  }, [creatingProvider, customProviderTemplate?.defaultBaseUrl, handleCreateProvider, t]);

  useEffect(() => {
    if (!onSelectionStateChange || selectionRole === undefined) {
      return;
    }

    onSelectionStateChange({
      canConfirm: canConfirmSelection,
      confirming: isConfirmingSelection,
    });
  }, [
    canConfirmSelection,
    isConfirmingSelection,
    onSelectionStateChange,
    selectionRole,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      confirmSelection: async () => {
        if (selectionRole === undefined) {
          return false;
        }

        return handleSetDefaultRole(selectionRole);
      },
      openCreateProviderDialog,
    }),
    [handleSetDefaultRole, openCreateProviderDialog, selectionRole],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
        <PlatformCard
          platforms={filteredProviders}
          selectedPlatform={selectedProviderCode}
          loadingPlatformId={loadingProviderId}
          searchQuery={searchQuery}
          onSelectPlatform={handleSelectProvider}
          onSearchQueryChange={setSearchQuery}
          onCreateProvider={openCreateProviderDialog}
        />

        <ApiConfigCard
          detail={currentDetail}
          selectedModelId={currentSelectedModelId}
          currentModelName={currentModelName}
          loading={loadingProviderId === selectedProviderCode}
          syncing={syncing}
          deleting={deletingProvider}
          hideRoleActions={selectionRole !== undefined}
          assigningRole={assigningRole}
          syncError={syncErrorByProvider[selectedProviderCode] ?? null}
          onApiKeyChange={(apiKey) => updateCurrentDetail({ apiKey })}
          onApiUrlChange={(baseUrl) => updateCurrentDetail({ baseUrl })}
          onSelectedModelChange={(value) => {
            setSelectedModelIds((prev) => ({
              ...prev,
              [selectedProviderCode]: value,
            }));
            if (value) {
              writeStoredModelNameDraft(
                activeSelectionRole,
                selectedProviderCode,
                value,
              );
              setCurrentModelNames((prev) => ({
                ...prev,
                [selectedProviderCode]: value,
              }));
            }
          }}
          onModelNameChange={(value) => {
            writeStoredModelNameDraft(
              activeSelectionRole,
              selectedProviderCode,
              value,
            );
            setCurrentModelNames((prev) => ({
              ...prev,
              [selectedProviderCode]: value,
            }));
          }}
          onTestConnection={handleSyncModels}
          onDeleteProvider={handleDeleteProvider}
          onSetDefaultRole={handleSetDefaultRole}
        />
      </div>
    </div>
  );
});

PlatformConfigModal.displayName = "PlatformConfigModal";

export default PlatformConfigModal;
