import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  CircleHelp,
  RefreshCcw,
  Save,
  Upload,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import {
  Button,
  CompactAudioPlayer,
  IconButton,
  Select,
  Slider,
  TextArea,
  TextInput,
  Tooltip,
} from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import { ApiError, ErrorCodes } from "@/shared/lib/request";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  getApiProviderCatalog,
  createGptSovitsSynthesis,
  createTtsSynthesis,
  type ApiProviderCatalog,
  getGptSovitsCatalog,
  bindGptSovitsReferenceAudio,
  getTtsAudioPreviewUrl,
  getTtsOverview,
  getTtsVoices,
  saveTtsReferenceAudio,
  updateTtsProvider,
  type GptSovitsCatalog,
  type TtsProviderConfigRecord,
  type TtsProviderId,
  type TtsSynthesisJobRecord,
  type TtsVoiceSummary,
} from "@/shared/api/tts";
import {
  deleteStoredGptSovitsRefAudio,
  listStoredGptSovitsRefAudios,
  saveStoredGptSovitsRefAudio,
  setStoredGptSovitsRefAudioServerId,
  toStoredGptSovitsRefAudioFile,
  type StoredGptSovitsRefAudio,
} from "./gptSovitsRefAudioStore";

type ProviderDraft = {
  enabled: boolean;
  displayName: string;
  config: Record<string, unknown>;
};

type StudioTab = "piper" | "gpt_sovits" | "api_provider";
type BaseTtsProviderId = Exclude<TtsProviderId, "gpt_sovits" | "api_provider">;

type GptSovitsFormState = {
  promptText: string;
  text: string;
  promptLanguage: string;
  textLanguage: string;
  gptModel: string;
  sovitsModel: string;
  cutMethod: string;
  sampleSteps: string;
  speed: string;
  pauseSecond: string;
  temperature: string;
  topK: string;
  topP: string;
};

type ParsedRefAudio = StoredGptSovitsRefAudio & {
  displayName: string;
  promptTextFromName: string;
  hasStructuredName: boolean;
};

const providerTitle: Record<TtsProviderId, string> = {
  windows_builtin: "内置语音",
  piper_local: "Piper 语音包",
  gpt_sovits: "GPT-SoVITS",
  api_provider: "API服务商",
};

const sourceOptions: Array<{ value: BaseTtsProviderId; label: string }> = [
  { value: "windows_builtin", label: "内置语音" },
  { value: "piper_local", label: "Piper 语音包" },
];

const voiceLabel = (voice: TtsVoiceSummary) => voice.label || voice.id;

const toDraft = (provider: TtsProviderConfigRecord): ProviderDraft => ({
  enabled: provider.enabled,
  displayName: provider.displayName,
  config: provider.config,
});

const pickStringOption = (value: string, options: string[], fallback = "") => {
  if (value && options.includes(value)) {
    return value;
  }
  if (fallback && options.includes(fallback)) {
    return fallback;
  }
  return options[0] ?? fallback;
};

const pickNumberOption = (
  value: string,
  options: number[],
  fallback: number,
) => {
  const next = Number(value);
  if (Number.isFinite(next) && options.includes(next)) {
    return String(next);
  }
  if (options.includes(fallback)) {
    return String(fallback);
  }
  return options[0] !== undefined ? String(options[0]) : String(fallback);
};

const getConfigString = (
  config: Record<string, unknown> | undefined,
  key: string,
) => (typeof config?.[key] === "string" ? config[key].trim() : "");

const getConfigNumber = (
  config: Record<string, unknown> | undefined,
  key: string,
) => {
  const raw = config?.[key];
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
};

const refAudioFileNamePattern = /^\[([^\]]+)\](.+)\.wav$/i;

const parseRefAudioFileName = (fileName: string) => {
  const match = fileName.match(refAudioFileNamePattern);
  const rawName = fileName.trim();
  if (!match) {
    return {
      displayName: rawName || fileName,
      promptTextFromName: "",
      hasStructuredName: false,
    };
  }

  const displayName = match[1]?.trim() ?? "";
  const promptTextFromName = match[2]?.trim() ?? "";
  if (!displayName || !promptTextFromName) {
    return {
      displayName: rawName || fileName,
      promptTextFromName: "",
      hasStructuredName: false,
    };
  }

  return {
    displayName,
    promptTextFromName,
    hasStructuredName: true,
  };
};

const buildGptFormFromCatalog = (
  catalog: GptSovitsCatalog,
  providerConfig?: Record<string, unknown>,
  current?: GptSovitsFormState,
): GptSovitsFormState => ({
  promptText: getConfigString(providerConfig, "promptText"),
  text:
    current?.text ?? "你好，这里是 UIChat Mira 的 GPT-SoVITS 微应用调试页。",
  promptLanguage: pickStringOption(
    getConfigString(providerConfig, "promptLanguage"),
    catalog.languageOptions,
    catalog.defaults.promptLanguage,
  ),
  textLanguage: pickStringOption(
    getConfigString(providerConfig, "textLanguage"),
    catalog.languageOptions,
    catalog.defaults.textLanguage,
  ),
  gptModel: pickStringOption(
    getConfigString(providerConfig, "gptModel"),
    catalog.gptModelOptions,
    catalog.defaults.gptModel,
  ),
  sovitsModel: pickStringOption(
    getConfigString(providerConfig, "sovitsModel"),
    catalog.sovitsModelOptions,
    catalog.defaults.sovitsModel,
  ),
  cutMethod: pickStringOption(
    getConfigString(providerConfig, "cutMethod"),
    catalog.cutMethodOptions,
    catalog.defaults.cutMethod,
  ),
  sampleSteps: pickNumberOption(
    String(getConfigNumber(providerConfig, "sampleSteps") ?? ""),
    catalog.sampleStepOptions,
    catalog.defaults.sampleSteps,
  ),
  speed: String(
    getConfigNumber(providerConfig, "speed") ?? catalog.defaults.speed,
  ),
  pauseSecond: String(
    getConfigNumber(providerConfig, "pauseSecond") ??
      catalog.defaults.pauseSecond,
  ),
  temperature: String(
    getConfigNumber(providerConfig, "temperature") ??
      catalog.defaults.temperature,
  ),
  topK: String(
    getConfigNumber(providerConfig, "topK") ?? catalog.defaults.topK,
  ),
  topP: String(
    getConfigNumber(providerConfig, "topP") ?? catalog.defaults.topP,
  ),
});

const stringifyComparable = (value: unknown) => JSON.stringify(value);

export default function TtsStudioPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<StudioTab>("piper");
  const [loading, setLoading] = useState(true);
  const [savingProviderId, setSavingProviderId] = useState<TtsProviderId | "">(
    "",
  );
  const [synthesizing, setSynthesizing] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [gptCatalogLoading, setGptCatalogLoading] = useState(false);
  const [gptCatalogError, setGptCatalogError] = useState("");
  const [apiProviderCatalogLoading, setApiProviderCatalogLoading] =
    useState(false);
  const [providers, setProviders] = useState<TtsProviderConfigRecord[]>([]);
  const [recentJobs, setRecentJobs] = useState<TtsSynthesisJobRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({});
  const [providerId, setProviderId] =
    useState<BaseTtsProviderId>("windows_builtin");
  const [voices, setVoices] = useState<TtsVoiceSummary[]>([]);
  const [text, setText] = useState(
    "你好，这里是 UIChat Mira 的 TTS 微应用调试页。",
  );
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [gptCatalog, setGptCatalog] = useState<GptSovitsCatalog | null>(null);
  const [apiProviderCatalog, setApiProviderCatalog] =
    useState<ApiProviderCatalog | null>(null);
  const [gptForm, setGptForm] = useState<GptSovitsFormState>({
    promptText: "",
    text: "你好，这里是 UIChat Mira 的 GPT-SoVITS 微应用调试页。",
    promptLanguage: "",
    textLanguage: "",
    gptModel: "",
    sovitsModel: "",
    cutMethod: "",
    sampleSteps: "8",
    speed: "1",
    pauseSecond: "0.3",
    temperature: "1",
    topK: "15",
    topP: "1",
  });
  const [apiProviderText, setApiProviderText] = useState(
    "你好，这里是 UIChat Mira 的 API 服务商 TTS 微应用调试页。",
  );
  const [storedRefAudios, setStoredRefAudios] = useState<
    StoredGptSovitsRefAudio[]
  >([]);
  const [selectedRefAudioId, setSelectedRefAudioId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProvider =
    providers.find((item) => item.providerId === providerId) ?? null;
  const selectedDraft = drafts[providerId] ?? null;
  const selectedGptDraft = drafts.gpt_sovits ?? null;
  const selectedApiDraft = drafts.api_provider ?? null;
  const parsedRefAudios = useMemo<ParsedRefAudio[]>(
    () =>
      storedRefAudios.map((item) => {
        const parsed = parseRefAudioFileName(item.name);
        return {
          ...item,
          ...parsed,
        };
      }),
    [storedRefAudios],
  );
  const selectedRefAudio =
    parsedRefAudios.find((item) => item.id === selectedRefAudioId) ?? null;
  const selectedJob =
    activeTab === "gpt_sovits"
      ? (recentJobs.find((item) => item.providerId === "gpt_sovits") ?? null)
      : activeTab === "api_provider"
        ? (recentJobs.find((item) => item.providerId === "api_provider") ??
          null)
        : (recentJobs.find((item) => item.providerId === providerId) ??
          recentJobs.find(
            (item) =>
              item.providerId !== "gpt_sovits" &&
              item.providerId !== "api_provider",
          ) ??
          null);

  const voiceOptions = useMemo(
    () => [
      {
        value: "",
        label:
          providerId === "windows_builtin"
            ? "使用系统默认语音"
            : "使用当前语音包默认音色",
      },
      ...voices.map((item) => ({
        value: item.id,
        label: voiceLabel(item),
      })),
    ],
    [providerId, voices],
  );

  const gptLanguageOptions = useMemo(
    () =>
      (gptCatalog?.languageOptions ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    [gptCatalog],
  );

  const gptModelOptions = useMemo(
    () =>
      (gptCatalog?.gptModelOptions ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    [gptCatalog],
  );

  const sovitsModelOptions = useMemo(
    () =>
      (gptCatalog?.sovitsModelOptions ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    [gptCatalog],
  );

  const cutMethodOptions = useMemo(
    () =>
      (gptCatalog?.cutMethodOptions ?? []).map((item) => ({
        value: item,
        label: item,
      })),
    [gptCatalog],
  );

  const sampleStepOptions = useMemo(
    () =>
      (gptCatalog?.sampleStepOptions ?? []).map((item) => ({
        value: String(item),
        label: String(item),
      })),
    [gptCatalog],
  );

  const storedRefAudioOptions = useMemo(
    () =>
      parsedRefAudios.map((item) => ({
        value: item.id,
        label: item.displayName,
      })),
    [parsedRefAudios],
  );

  const apiResponseFormatOptions = useMemo(
    () => [
      { value: "mp3", label: "MP3" },
      { value: "wav", label: "WAV" },
      { value: "opus", label: "Opus" },
      { value: "flac", label: "FLAC" },
      { value: "pcm", label: "PCM" },
    ],
    [],
  );

  const loadStoredRefAudios = async (preferredId?: string) => {
    try {
      const items = await listStoredGptSovitsRefAudios();
      setStoredRefAudios(items);
      setSelectedRefAudioId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current;
        }
        if (preferredId && items.some((item) => item.id === preferredId)) {
          return preferredId;
        }
        return items[0]?.id ?? "";
      });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "加载参考音频失败",
      );
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const overview = await getTtsOverview();
      setProviders(overview.providers);
      setRecentJobs(overview.recentJobs);
      const nextDrafts = Object.fromEntries(
        overview.providers.map((item) => [item.providerId, toDraft(item)]),
      );
      setDrafts(nextDrafts);
      const savedRefAudioId = getConfigString(
        nextDrafts.gpt_sovits?.config,
        "selectedRefAudioId",
      );
      if (savedRefAudioId) {
        setSelectedRefAudioId(savedRefAudioId);
      }
      if (!overview.providers.some((item) => item.providerId === providerId)) {
        setProviderId("windows_builtin");
      }
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "加载 TTS 工作台失败",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async (nextProviderId: BaseTtsProviderId) => {
    setVoicesLoading(true);
    try {
      const result = await getTtsVoices(nextProviderId);
      setVoices(result.voices);
    } catch (error) {
      setVoices([]);
      message.error(
        error instanceof Error ? error.message : "加载语音列表失败",
      );
    } finally {
      setVoicesLoading(false);
    }
  };

  const loadGptSovits = async () => {
    setGptCatalogLoading(true);
    setGptCatalogError("");
    try {
      const result = await getGptSovitsCatalog();
      setGptCatalog(result.catalog);
      setGptForm((current) =>
        buildGptFormFromCatalog(
          result.catalog,
          selectedGptDraft?.config,
          current,
        ),
      );
    } catch (error) {
      setGptCatalog(null);
      setGptCatalogError(
        error instanceof Error ? error.message : "GPT-SoVITS 服务当前不可用",
      );
    } finally {
      setGptCatalogLoading(false);
    }
  };

  const loadApiProvider = async () => {
    setApiProviderCatalogLoading(true);
    try {
      const result = await getApiProviderCatalog();
      setApiProviderCatalog(result.catalog);
    } catch (error) {
      setApiProviderCatalog(null);
      message.error(
        error instanceof Error ? error.message : "加载 API 服务商配置失败",
      );
    } finally {
      setApiProviderCatalogLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    void loadVoices(providerId);
  }, [providerId]);

  useEffect(() => {
    if (activeTab === "gpt_sovits") {
      void loadGptSovits();
      void loadStoredRefAudios(
        getConfigString(selectedGptDraft?.config, "selectedRefAudioId"),
      );
      return;
    }
    if (activeTab === "api_provider") {
      void loadApiProvider();
    }
  }, [activeTab, selectedGptDraft?.config]);

  useEffect(() => {
    if (
      !selectedRefAudio?.hasStructuredName ||
      !selectedRefAudio.promptTextFromName
    ) {
      return;
    }
    setGptForm((current) =>
      current.promptText === selectedRefAudio.promptTextFromName
        ? current
        : { ...current, promptText: selectedRefAudio.promptTextFromName },
    );
  }, [selectedRefAudio]);

  useEffect(() => {
    if (!selectedJob || selectedJob.status !== "succeeded") {
      setAudioPreviewUrl((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return "";
      });
      return;
    }

    let cancelled = false;

    void getTtsAudioPreviewUrl(selectedJob.id)
      .then((nextUrl) => {
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }

        setAudioPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return nextUrl;
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setAudioPreviewUrl((current) => {
            if (current) {
              URL.revokeObjectURL(current);
            }
            return "";
          });
          if (!(error instanceof ApiError && error.code === ErrorCodes.NOT_FOUND)) {
            message.error(
              error instanceof Error ? error.message : "加载音频预览失败",
            );
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedJob]);

  useEffect(() => {
    return () => {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
      }
    };
  }, [audioPreviewUrl]);

  const playerStatusMessage = !selectedJob
    ? ""
    : selectedJob.status === "succeeded"
      ? audioPreviewUrl
        ? ""
        : "音频预览还在加载，请稍等。"
      : selectedJob.status === "failed"
        ? ""
        : "当前任务还没有可播放音频，等待合成完成后会更新。";

  const baseProviderSavePayload = selectedDraft
    ? {
        enabled: true,
        displayName: selectedDraft.displayName.trim(),
        config: selectedDraft.config,
      }
    : null;

  const persistedBaseProviderPayload = selectedProvider
    ? {
        enabled: true,
        displayName: selectedProvider.displayName.trim(),
        config: selectedProvider.config,
      }
    : null;

  const isBaseProviderDirty =
    Boolean(baseProviderSavePayload) &&
    Boolean(persistedBaseProviderPayload) &&
    stringifyComparable(baseProviderSavePayload) !==
      stringifyComparable(persistedBaseProviderPayload);

  const gptProviderSavePayload = selectedGptDraft
    ? {
        enabled: true,
        displayName:
          selectedGptDraft.displayName.trim() || providerTitle.gpt_sovits,
        config: {
          ...(selectedGptDraft.config ?? {}),
          baseUrl: String(selectedGptDraft.config.baseUrl ?? "").trim(),
          selectedRefAudioId,
          promptText: gptForm.promptText.trim(),
          gptModel: gptForm.gptModel,
          sovitsModel: gptForm.sovitsModel,
          promptLanguage: gptForm.promptLanguage,
          textLanguage: gptForm.textLanguage,
          cutMethod: gptForm.cutMethod,
          sampleSteps: Number(gptForm.sampleSteps),
          speed: Number(gptForm.speed),
          pauseSecond: Number(gptForm.pauseSecond),
          temperature: Number(gptForm.temperature),
          topK: Number(gptForm.topK),
          topP: Number(gptForm.topP),
        },
      }
    : null;

  const persistedGptProviderPayload = providers.find(
    (item) => item.providerId === "gpt_sovits",
  )
    ? {
        enabled: true,
        displayName:
          providers
            .find((item) => item.providerId === "gpt_sovits")
            ?.displayName.trim() ?? "",
        config:
          providers.find((item) => item.providerId === "gpt_sovits")?.config ??
          {},
      }
    : null;

  const isGptProviderDirty =
    Boolean(gptProviderSavePayload) &&
    Boolean(persistedGptProviderPayload) &&
    stringifyComparable(gptProviderSavePayload) !==
      stringifyComparable(persistedGptProviderPayload);

  const apiProviderSavePayload = selectedApiDraft
    ? {
        enabled: true,
        displayName:
          selectedApiDraft.displayName.trim() || providerTitle.api_provider,
        config: {
          ...(selectedApiDraft.config ?? {}),
          voice: String(selectedApiDraft.config.voice ?? "").trim(),
          responseFormat: String(
            selectedApiDraft.config.responseFormat ?? "mp3",
          ).trim(),
          speed: Number(selectedApiDraft.config.speed ?? 1),
        },
      }
    : null;

  const persistedApiProvider =
    providers.find((item) => item.providerId === "api_provider") ?? null;

  const persistedApiProviderPayload = persistedApiProvider
    ? {
        enabled: true,
        displayName: persistedApiProvider.displayName.trim(),
        config: persistedApiProvider.config,
      }
    : null;

  const isApiProviderDirty =
    Boolean(apiProviderSavePayload) &&
    Boolean(persistedApiProviderPayload) &&
    stringifyComparable(apiProviderSavePayload) !==
      stringifyComparable(persistedApiProviderPayload);

  const isVolcengineVoiceProvider =
    apiProviderCatalog?.providerCode === "volcengine";
  const apiVoiceFieldHelp = isVolcengineVoiceProvider
    ? "这里要填火山方舟语音文档里的 speaker / 音色 ID，见文档: https://docs.volcengine.com/docs/6561/1257544?lang=zh。"
    : "这里填写当前语音模型要求的音色名。OpenAI 兼容 speech 服务商通常可填 alloy、nova 这类音色名。";

  const updateProviderConfig = (
    targetProviderId: TtsProviderId,
    key: string,
    value: unknown,
  ) => {
    setDrafts((current) => ({
      ...current,
      [targetProviderId]: {
        ...(current[targetProviderId] ?? {
          enabled: true,
          displayName: providerTitle[targetProviderId],
          config: {},
        }),
        config: {
          ...(current[targetProviderId]?.config ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const updateProviderMeta = (
    targetProviderId: TtsProviderId,
    key: "displayName",
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [targetProviderId]: {
        ...(current[targetProviderId] ?? {
          enabled: true,
          displayName: providerTitle[targetProviderId],
          config: {},
        }),
        [key]: value,
      } as ProviderDraft,
    }));
  };

  const saveBaseProvider = async () => {
    const draft = drafts[providerId];
    if (!draft) {
      return;
    }

    setSavingProviderId(providerId);
    try {
      await updateTtsProvider(providerId, {
        ...(baseProviderSavePayload ?? {
          enabled: true,
          displayName: draft.displayName.trim(),
          config: draft.config,
        }),
      });
      message.success("TTS provider 配置已保存");
      await loadOverview();
      await loadVoices(providerId);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "保存 TTS provider 失败",
      );
    } finally {
      setSavingProviderId("");
    }
  };

  const saveGptProvider = async () => {
    const draft = drafts.gpt_sovits;
    if (!draft) {
      return;
    }

    setSavingProviderId("gpt_sovits");
    try {
      let serverRefAudioId = selectedRefAudio?.serverRefAudioId;
      if (selectedRefAudio && !serverRefAudioId) {
        const saved = await saveTtsReferenceAudio(
          toStoredGptSovitsRefAudioFile(selectedRefAudio),
        );
        serverRefAudioId = saved.refAudio.id;
        await setStoredGptSovitsRefAudioServerId(selectedRefAudio.id, serverRefAudioId);
        await bindGptSovitsReferenceAudio({
          clientRefAudioId: selectedRefAudio.id,
          serverRefAudioId,
        });
        await loadStoredRefAudios(selectedRefAudio.id);
      }
      const nextGptConfig = {
        ...(draft.config ?? {}),
        baseUrl: String(draft.config.baseUrl ?? "").trim(),
        selectedRefAudioId,
        ...(serverRefAudioId ? { serverRefAudioId } : {}),
        promptText: gptForm.promptText.trim(),
        gptModel: gptForm.gptModel,
        sovitsModel: gptForm.sovitsModel,
        promptLanguage: gptForm.promptLanguage,
        textLanguage: gptForm.textLanguage,
        cutMethod: gptForm.cutMethod,
        sampleSteps: Number(gptForm.sampleSteps),
        speed: Number(gptForm.speed),
        pauseSecond: Number(gptForm.pauseSecond),
        temperature: Number(gptForm.temperature),
        topK: Number(gptForm.topK),
        topP: Number(gptForm.topP),
      };
      await updateTtsProvider("gpt_sovits", {
        enabled: true,
        displayName: draft.displayName.trim() || providerTitle.gpt_sovits,
        config: nextGptConfig,
      });
      message.success("GPT-SoVITS 配置已保存");
      await loadOverview();
      await loadGptSovits();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "保存 GPT-SoVITS 配置失败",
      );
    } finally {
      setSavingProviderId("");
    }
  };

  const saveApiProvider = async () => {
    const draft = drafts.api_provider;
    if (!draft) {
      return;
    }

    setSavingProviderId("api_provider");
    try {
      await updateTtsProvider("api_provider", {
        ...(apiProviderSavePayload ?? {
          enabled: true,
          displayName: draft.displayName.trim() || providerTitle.api_provider,
          config: {
            ...(draft.config ?? {}),
            voice: String(draft.config.voice ?? "").trim(),
            responseFormat: String(draft.config.responseFormat ?? "mp3").trim(),
            speed: Number(draft.config.speed ?? 1),
          },
        }),
      });
      message.success("API 服务商配置已保存");
      await loadOverview();
      await loadApiProvider();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "保存 API 服务商配置失败",
      );
    } finally {
      setSavingProviderId("");
    }
  };

  const runBaseSynthesis = async () => {
    if (!text.trim()) {
      message.error("请先输入要合成的文本");
      return;
    }

    setSynthesizing(true);
    try {
      await createTtsSynthesis({
        providerId,
        text: text.trim(),
      });
      message.success("语音合成完成");
      await loadOverview();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "语音合成失败");
    } finally {
      setSynthesizing(false);
    }
  };

  const runGptSynthesis = async () => {
    if (!selectedRefAudio) {
      message.error("请先上传参考音频文件");
      return;
    }
    if (!gptForm.text.trim()) {
      message.error("请先输入要合成的文本");
      return;
    }

    setSynthesizing(true);
    try {
      let serverRefAudioId = selectedRefAudio.serverRefAudioId;
      if (!serverRefAudioId) {
        const refAudioFile = toStoredGptSovitsRefAudioFile(selectedRefAudio);
        const saved = await saveTtsReferenceAudio(refAudioFile);
        serverRefAudioId = saved.refAudio.id;
        await setStoredGptSovitsRefAudioServerId(
          selectedRefAudio.id,
          serverRefAudioId,
        );
        await loadStoredRefAudios();
      }
      await bindGptSovitsReferenceAudio({
        clientRefAudioId: selectedRefAudio.id,
        serverRefAudioId,
      });
      const { job } = await createGptSovitsSynthesis({
        text: gptForm.text.trim(),
        refAudioId: serverRefAudioId,
      });
      if (job.status !== "succeeded") {
        throw new Error(job.errorMessage || "语音合成失败");
      }
      message.success("语音合成完成");
      await loadOverview();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "语音合成失败");
    } finally {
      setSynthesizing(false);
    }
  };

  const runApiProviderSynthesis = async () => {
    if (!apiProviderText.trim()) {
      message.error("请先输入要合成的文本");
      return;
    }

    setSynthesizing(true);
    try {
      const { job } = await createTtsSynthesis({
        providerId: "api_provider",
        text: apiProviderText.trim(),
        voice: String(selectedApiDraft?.config.voice ?? "").trim() || undefined,
        responseFormat:
          String(selectedApiDraft?.config.responseFormat ?? "").trim() ||
          undefined,
        speed: Number(selectedApiDraft?.config.speed ?? Number.NaN),
      });
      if (job.status && job.status !== "succeeded") {
        throw new Error(job.errorMessage || "语音合成失败");
      }
      message.success("语音合成完成");
      await loadOverview();
      await loadApiProvider();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "语音合成失败");
    } finally {
      setSynthesizing(false);
    }
  };

  const handleSelectRefAudioFiles = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".wav")) {
      message.error("只支持上传 wav 文件");
      return;
    }

    try {
      const saved = await saveStoredGptSovitsRefAudio(file);
      await loadStoredRefAudios();
      setSelectedRefAudioId(saved.id);
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "保存参考音频失败",
      );
    }
  };

  const handleDeleteRefAudio = async (id: string) => {
    try {
      await deleteStoredGptSovitsRefAudio(id);
      await loadStoredRefAudios();
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "删除参考音频失败",
      );
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle={t("settings.microApps.studioEntries.ttsStudio.page.miniTitle")}
      title={t("settings.microApps.studioEntries.ttsStudio.page.title")}
      description={t("settings.microApps.studioEntries.ttsStudio.page.description")}
      contentClassName="pt-6"
      scrollBody={false}
      slot={
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadOverview()}
          disabled={loading}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {t("settings.microApps.studioEntries.ttsStudio.page.refresh")}
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <NavigationCardTabs<StudioTab>
            tabs={[
              {
                value: "piper",
                label: "Piper",
                icon: <AudioLines className="h-4 w-4" />,
              },
              {
                value: "gpt_sovits",
                label: "GPT-SoVITS",
                icon: <Waves className="h-4 w-4" />,
              },
              {
                value: "api_provider",
                label: "API服务商",
                icon: <Volume2 className="h-4 w-4" />,
              },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pt-6">
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="shrink-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-text-primary">
                  结果预览
                </div>
                {selectedJob ? (
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        selectedJob.status === "succeeded"
                          ? "success"
                          : selectedJob.status === "failed"
                            ? "danger"
                            : "warning"
                      }
                      size="sm"
                    >
                      {selectedJob.status}
                    </Badge>
                    {selectedJob.status === "failed" ? (
                      <Tooltip
                        text={
                          selectedJob.errorMessage?.trim() ||
                          "当前任务失败，但没有返回更具体的失败原因。"
                        }
                        placement="top"
                      >
                        <span className="inline-flex cursor-help text-icon-secondary">
                          <CircleHelp className="h-3.5 w-3.5" />
                        </span>
                      </Tooltip>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {!selectedJob ? (
                <Alert variant="info" title="暂无结果">
                  当前还没有可预览的语音结果。
                </Alert>
              ) : (
                <div className="space-y-4">
                  <CompactAudioPlayer
                    key={selectedJob.id}
                    src={audioPreviewUrl}
                    title={providerTitle[selectedJob.providerId]}
                    subtitle={
                      selectedJob.status === "succeeded"
                        ? selectedJob.text
                        : "--"
                    }
                    statusMessage={playerStatusMessage}
                    disabled={!audioPreviewUrl}
                  />
                </div>
              )}
            </div>

            {activeTab === "gpt_sovits" ? (
              <div className="grid min-h-0 flex-1 items-stretch gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="flex h-full min-h-0 flex-col">
                  <Card className="h-full min-h-0 flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Waves className="h-5 w-5 text-primary" />
                            <div className="text-base font-semibold text-text-primary">
                              GPT-SoVITS 配置
                            </div>
                          </div>
                        </div>
                      </div>

                      {gptCatalogError ? (
                        <Alert variant="warning" title="GPT-SoVITS 未连接">
                          当前无法读取 GPT-SoVITS 配置。请先启动 GPT-SoVITS 服务；这不会影响 Piper 和 API 服务商。
                        </Alert>
                      ) : null}

                      {selectedGptDraft ? (
                        <div className="flex h-full min-h-0 flex-1 flex-col">
                          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pl-1 pr-1 pb-3">
                            <div className="space-y-4">
                              <TextInput
                                label="显示名称"
                                value={selectedGptDraft.displayName}
                                onChange={(value) =>
                                  updateProviderMeta(
                                    "gpt_sovits",
                                    "displayName",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                              />

                              <TextInput
                                label="服务地址"
                                value={String(
                                  selectedGptDraft.config.baseUrl ?? "",
                                )}
                                onChange={(value) =>
                                  updateProviderConfig(
                                    "gpt_sovits",
                                    "baseUrl",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                                placeholder="http://127.0.0.1:9872"
                              />

                              <Select
                                label="GPT 模型"
                                value={gptForm.gptModel}
                                onChange={(value) =>
                                  setGptForm((current) => ({
                                    ...current,
                                    gptModel: value,
                                  }))
                                }
                                options={gptModelOptions}
                                disabled={
                                  gptCatalogLoading || Boolean(savingProviderId)
                                }
                              />

                              <Select
                                label="SoVITS 模型"
                                value={gptForm.sovitsModel}
                                onChange={(value) =>
                                  setGptForm((current) => ({
                                    ...current,
                                    sovitsModel: value,
                                  }))
                                }
                                options={sovitsModelOptions}
                                disabled={
                                  gptCatalogLoading || Boolean(savingProviderId)
                                }
                              />

                              <div className="space-y-2">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                                  <span>参考音频文件</span>
                                  <Tooltip
                                    text="上传格式：[名称]参考文本.wav"
                                    placement="top"
                                  >
                                    <span className="inline-flex text-icon-secondary">
                                      <CircleHelp className="h-3.5 w-3.5" />
                                    </span>
                                  </Tooltip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="min-w-0 flex-1">
                                    <Select
                                      value={selectedRefAudioId}
                                      onChange={setSelectedRefAudioId}
                                      options={storedRefAudioOptions}
                                      disabled={storedRefAudios.length === 0}
                                      endAction={
                                        selectedRefAudio
                                          ? {
                                              ariaLabel: "删除参考音频",
                                              icon: (
                                                <X className="h-3.5 w-3.5" />
                                              ),
                                              onClick: () =>
                                                void handleDeleteRefAudio(
                                                  selectedRefAudio.id,
                                                ),
                                            }
                                          : undefined
                                      }
                                    />
                                  </div>
                                  <IconButton
                                    ariaLabel="上传参考音频"
                                    styleType="outline"
                                    size="lg"
                                    onClick={() =>
                                      fileInputRef.current?.click()
                                    }
                                    className="shrink-0 self-stretch"
                                  >
                                    <Upload className="h-4 w-4" />
                                  </IconButton>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".wav,audio/wav"
                                    className="hidden"
                                    onChange={handleSelectRefAudioFiles}
                                  />
                                </div>
                              </div>

                              <TextArea
                                label="参考文本"
                                value={gptForm.promptText}
                                onChange={(value) =>
                                  setGptForm((current) => ({
                                    ...current,
                                    promptText: value,
                                  }))
                                }
                                rows={4}
                              />

                              <div className="grid gap-4 sm:grid-cols-2">
                                <Select
                                  label="参考语种"
                                  value={gptForm.promptLanguage}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      promptLanguage: value,
                                    }))
                                  }
                                  options={gptLanguageOptions}
                                  disabled={gptCatalogLoading}
                                />
                                <Select
                                  label="目标语言"
                                  value={gptForm.textLanguage}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      textLanguage: value,
                                    }))
                                  }
                                  options={gptLanguageOptions}
                                  disabled={gptCatalogLoading}
                                />
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <Select
                                  label="采样步数"
                                  value={gptForm.sampleSteps}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      sampleSteps: value,
                                    }))
                                  }
                                  options={sampleStepOptions}
                                  disabled={gptCatalogLoading}
                                />
                                <Select
                                  label="切割方式"
                                  value={gptForm.cutMethod}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      cutMethod: value,
                                    }))
                                  }
                                  options={cutMethodOptions}
                                  disabled={gptCatalogLoading}
                                />
                              </div>

                              <div className="space-y-4">
                                <Slider
                                  label="语速"
                                  labelHelp="范围 0.6 到 1.65"
                                  value={Number(gptForm.speed)}
                                  min={0.6}
                                  max={1.65}
                                  step={0.01}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      speed: String(value),
                                    }))
                                  }
                                />
                                <Slider
                                  label="句间停顿秒数"
                                  labelHelp="范围 0.1 到 0.5"
                                  value={Number(gptForm.pauseSecond)}
                                  min={0.1}
                                  max={0.5}
                                  step={0.01}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      pauseSecond: String(value),
                                    }))
                                  }
                                />
                                <Slider
                                  label="温度"
                                  value={Number(gptForm.temperature)}
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      temperature: String(value),
                                    }))
                                  }
                                />
                                <Slider
                                  label="Top K"
                                  value={Number(gptForm.topK)}
                                  min={1}
                                  max={100}
                                  step={1}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      topK: String(value),
                                    }))
                                  }
                                />
                                <Slider
                                  label="Top P"
                                  value={Number(gptForm.topP)}
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  onChange={(value) =>
                                    setGptForm((current) => ({
                                      ...current,
                                      topP: String(value),
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          <div className="mt-auto pt-4">
                            <Button
                              className="w-full"
                              variant="primary"
                              onClick={() => void saveGptProvider()}
                              disabled={
                                Boolean(savingProviderId) || !isGptProviderDirty
                              }
                            >
                              <Save className="h-4 w-4" />
                              保存 Provider
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Alert variant="info" title="暂无 Provider 配置">
                          当前还没有可用的 GPT-SoVITS 配置。
                        </Alert>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="flex h-full min-h-0 flex-col">
                  <Card className="h-full min-h-0 flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Volume2 className="h-5 w-5 text-primary" />
                        合成请求
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <label className="flex h-5 items-center text-xs font-medium text-text-secondary">
                          要合成的文本
                        </label>
                        <textarea
                          value={gptForm.text}
                          onChange={(event) =>
                            setGptForm((current) => ({
                              ...current,
                              text: event.target.value,
                            }))
                          }
                          className="
                            min-h-[320px]
                            flex-1
                            w-full
                            resize-y
                            rounded-ui-control
                            border
                            border-border
                            bg-surface-primary
                            px-3.5
                            py-2.5
                            text-sm
                            text-text-primary
                            shadow-shadow-sm
                            transition-[background-color,border-color,box-shadow]
                            duration-150
                            ease-out
                            placeholder:text-text-tertiary
                            focus:outline-none
                            focus:ring-2
                            focus:ring-primary/20
                            focus:border-primary
                          "
                        />
                      </div>

                      <div className="mt-auto pt-4">
                        <Button
                          className="w-full"
                          variant="primary"
                          onClick={() => void runGptSynthesis()}
                          disabled={synthesizing || gptCatalogLoading}
                        >
                          {synthesizing ? "合成中..." : "开始合成"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : activeTab === "api_provider" ? (
              <div className="grid min-h-0 flex-1 items-stretch gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="flex h-full flex-col">
                  <Card className="h-full max-h-[500px] flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Volume2 className="h-5 w-5 text-primary" />
                            <div className="text-base font-semibold text-text-primary">
                              API服务商 配置
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedApiDraft ? (
                        <div className="flex h-full min-h-0 flex-1 flex-col">
                          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
                            <div className="space-y-4">
                              {apiProviderCatalog?.errorMessage ? (
                                <Alert
                                  variant={
                                    apiProviderCatalog.configured
                                      ? "warning"
                                      : "info"
                                  }
                                  title={
                                    apiProviderCatalog.configured
                                      ? "当前 voice 模型暂不可用"
                                      : "当前 voice 模型未配置"
                                  }
                                >
                                  {apiProviderCatalog.errorMessage}
                                </Alert>
                              ) : null}

                              <TextInput
                                label="显示名称"
                                value={selectedApiDraft.displayName}
                                onChange={(value) =>
                                  updateProviderMeta(
                                    "api_provider",
                                    "displayName",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                              />

                              <TextInput
                                label="当前 Provider"
                                value={
                                  apiProviderCatalog?.providerDisplayName ?? ""
                                }
                                onChange={() => undefined}
                                disabled
                                placeholder={
                                  apiProviderCatalogLoading
                                    ? "加载中..."
                                    : "未绑定 voice 模型"
                                }
                              />

                              <TextInput
                                label="服务地址"
                                value={apiProviderCatalog?.baseUrl ?? ""}
                                onChange={() => undefined}
                                disabled
                                placeholder={
                                  apiProviderCatalogLoading
                                    ? "加载中..."
                                    : "未绑定 voice 模型"
                                }
                              />

                              <TextInput
                                label="当前模型"
                                value={apiProviderCatalog?.modelName ?? ""}
                                onChange={() => undefined}
                                disabled
                                placeholder={
                                  apiProviderCatalogLoading
                                    ? "加载中..."
                                    : "未绑定 voice 模型"
                                }
                              />

                              <TextInput
                                label={
                                  isVolcengineVoiceProvider
                                    ? "音色 / Speaker ID"
                                    : "音色"
                                }
                                labelHelp={apiVoiceFieldHelp}
                                value={String(
                                  selectedApiDraft.config.voice ?? "",
                                )}
                                onChange={(value) =>
                                  updateProviderConfig(
                                    "api_provider",
                                    "voice",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                                placeholder={
                                  isVolcengineVoiceProvider
                                    ? "例如方舟文档里的 speaker ID"
                                    : "例如 alloy"
                                }
                              />

                              <Select
                                label="输出格式"
                                value={String(
                                  selectedApiDraft.config.responseFormat ??
                                    "mp3",
                                )}
                                onChange={(value) =>
                                  updateProviderConfig(
                                    "api_provider",
                                    "responseFormat",
                                    value,
                                  )
                                }
                                options={apiResponseFormatOptions}
                                disabled={Boolean(savingProviderId)}
                              />

                              <Slider
                                label="语速"
                                labelHelp="远程 speech 接口常见范围 0.25 到 4"
                                value={Number(
                                  selectedApiDraft.config.speed ?? 1,
                                )}
                                min={0.25}
                                max={4}
                                step={0.05}
                                onChange={(value) =>
                                  updateProviderConfig(
                                    "api_provider",
                                    "speed",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                              />
                            </div>
                          </div>

                          <div className="mt-auto -mb-1">
                            <Button
                              variant="primary"
                              onClick={() => void saveApiProvider()}
                              disabled={
                                Boolean(savingProviderId) || !isApiProviderDirty
                              }
                              className="w-full"
                            >
                              <Save className="h-4 w-4" />
                              保存配置
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Alert variant="info" title="暂无 Provider 配置">
                          当前还没有可用的 API 服务商配置。
                        </Alert>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="flex h-full flex-col">
                  <Card className="h-full max-h-[500px] flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Volume2 className="h-5 w-5 text-primary" />
                        合成请求
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <label className="flex h-5 items-center text-xs font-medium text-text-secondary">
                          要合成的文本
                        </label>
                        <textarea
                          value={apiProviderText}
                          onChange={(event) =>
                            setApiProviderText(event.target.value)
                          }
                          placeholder="输入一段文本，快速验证当前 voice 模型的远程合成闭环。"
                          className="
                            min-h-0
                            flex-1
                            w-full
                            resize-y
                            rounded-ui-control
                            border
                            border-border
                            bg-surface-primary
                            px-3.5
                            py-2.5
                            text-sm
                            text-text-primary
                            shadow-shadow-sm
                            transition-[background-color,border-color,box-shadow]
                            duration-150
                            ease-out
                            placeholder:text-text-tertiary
                            focus:outline-none
                            focus:ring-2
                            focus:ring-primary/20
                            focus:border-primary
                          "
                        />
                      </div>

                      <div className="mt-auto -mb-1">
                        <Button
                          variant="primary"
                          onClick={() => void runApiProviderSynthesis()}
                          disabled={
                            synthesizing ||
                            apiProviderCatalogLoading ||
                            !apiProviderCatalog?.configured
                          }
                          className="w-full"
                        >
                          {synthesizing ? "合成中..." : "开始合成"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            ) : (
              <div className="grid min-h-0 flex-1 items-stretch gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="flex h-full flex-col">
                  <Card className="h-full max-h-[500px] flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <AudioLines className="h-5 w-5 text-primary" />
                            <div className="text-base font-semibold text-text-primary">
                              Piper 配置
                            </div>
                          </div>
                        </div>
                      </div>

                      {selectedProvider && selectedDraft ? (
                        <div className="flex h-full min-h-0 flex-1 flex-col">
                          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
                            <div className="space-y-4">
                              <Select
                                label="语音来源"
                                value={providerId}
                                onChange={(value) =>
                                  setProviderId(
                                    ((value as BaseTtsProviderId) ||
                                      "windows_builtin") as BaseTtsProviderId,
                                  )
                                }
                                options={sourceOptions}
                                disabled={loading || providers.length === 0}
                              />

                              <TextInput
                                label="显示名称"
                                value={selectedDraft.displayName}
                                onChange={(value) =>
                                  updateProviderMeta(
                                    providerId,
                                    "displayName",
                                    value,
                                  )
                                }
                                disabled={Boolean(savingProviderId)}
                              />

                              {providerId === "windows_builtin" ? (
                                <>
                                  <Select
                                    label="默认系统语音"
                                    value={String(
                                      selectedDraft.config.defaultVoice ?? "",
                                    )}
                                    onChange={(value) =>
                                      updateProviderConfig(
                                        providerId,
                                        "defaultVoice",
                                        value,
                                      )
                                    }
                                    options={voiceOptions}
                                    disabled={
                                      Boolean(savingProviderId) || voicesLoading
                                    }
                                  />
                                  <div className="space-y-4">
                                    <Slider
                                      label="默认语速"
                                      value={Number(
                                        selectedDraft.config.rate ?? 0,
                                      )}
                                      min={-10}
                                      max={10}
                                      step={1}
                                      onChange={(value) =>
                                        updateProviderConfig(
                                          providerId,
                                          "rate",
                                          value,
                                        )
                                      }
                                      disabled={Boolean(savingProviderId)}
                                      labelHelp="Windows 建议范围 -10 到 10"
                                    />
                                    <Slider
                                      label="默认音量"
                                      value={Number(
                                        selectedDraft.config.volume ?? 100,
                                      )}
                                      min={0}
                                      max={100}
                                      step={1}
                                      onChange={(value) =>
                                        updateProviderConfig(
                                          providerId,
                                          "volume",
                                          value,
                                        )
                                      }
                                      disabled={Boolean(savingProviderId)}
                                    />
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <TextInput
                                      label="语音包文件"
                                      value={String(
                                        selectedDraft.config.modelPath ?? "",
                                      )}
                                      onChange={(value) =>
                                        updateProviderConfig(
                                          providerId,
                                          "modelPath",
                                          value,
                                        )
                                      }
                                      placeholder="例如 C:\\models\\zh_CN-huayan-medium.onnx"
                                      disabled={Boolean(savingProviderId)}
                                    />
                                    <TextInput
                                      label="语音包标签"
                                      value={String(
                                        selectedDraft.config.voiceLabel ?? "",
                                      )}
                                      onChange={(value) =>
                                        updateProviderConfig(
                                          providerId,
                                          "voiceLabel",
                                          value,
                                        )
                                      }
                                      placeholder="例如 zh_CN-huayan-medium"
                                      disabled={Boolean(savingProviderId)}
                                    />
                                  </div>
                                  <TextInput
                                    label="默认 Speaker"
                                    value={String(
                                      selectedDraft.config.speaker ?? "",
                                    )}
                                    onChange={(value) =>
                                      updateProviderConfig(
                                        providerId,
                                        "speaker",
                                        value,
                                      )
                                    }
                                    placeholder="可选，留空表示使用模型默认 speaker"
                                    disabled={Boolean(savingProviderId)}
                                  />
                                </>
                              )}
                            </div>
                          </div>

                          <div className="mt-auto -mb-1">
                            <Button
                              variant="primary"
                              onClick={() => void saveBaseProvider()}
                              disabled={
                                Boolean(savingProviderId) ||
                                !isBaseProviderDirty
                              }
                              className="w-full"
                            >
                              <Save className="h-4 w-4" />
                              保存配置
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Alert variant="info" title="暂无 Provider 配置">
                          当前还没有可用的 TTS provider 配置。
                        </Alert>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="flex h-full flex-col">
                  <Card className="h-full max-h-[500px] flex-1 p-5">
                    <div className="flex h-full min-h-0 flex-col gap-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Volume2 className="h-5 w-5 text-primary" />
                        合成请求
                      </div>

                      <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <label className="flex h-5 items-center text-xs font-medium text-text-secondary">
                          要合成的文本
                        </label>
                        <textarea
                          value={text}
                          onChange={(event) => setText(event.target.value)}
                          placeholder="输入一段文本，快速验证桌面 TTS 闭环。"
                          className="
                            min-h-0
                            flex-1
                            w-full
                            resize-y
                            rounded-ui-control
                            border
                            border-border
                            bg-surface-primary
                            px-3.5
                            py-2.5
                            text-sm
                            text-text-primary
                            shadow-shadow-sm
                            transition-[background-color,border-color,box-shadow]
                            duration-150
                            ease-out
                            placeholder:text-text-tertiary
                            focus:outline-none
                            focus:ring-2
                            focus:ring-primary/20
                            focus:border-primary
                          "
                        />
                      </div>

                      <div className="mt-auto -mb-1">
                        <Button
                          variant="primary"
                          onClick={() => void runBaseSynthesis()}
                          disabled={synthesizing || loading}
                          className="w-full"
                        >
                          {synthesizing ? "合成中..." : "开始合成"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MicroAppPageLayout>
  );
}
