import { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  RefreshCcw,
  Save,
  Upload,
  Volume2,
  Waves,
  X,
} from "lucide-react";
import Card from "@/shared/ui/Card";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import NavigationCardTabs from "@/shared/ui/NavigationCardTabs";
import { Button, IconButton, Select, Slider, TextArea, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  createGptSovitsSynthesis,
  createTtsSynthesis,
  getGptSovitsCatalog,
  getTtsAudioPreviewUrl,
  getTtsOverview,
  getTtsVoices,
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
  toStoredGptSovitsRefAudioFile,
  type StoredGptSovitsRefAudio,
} from "./gptSovitsRefAudioStore";

type ProviderDraft = {
  enabled: boolean;
  displayName: string;
  config: Record<string, unknown>;
};

type StudioTab = "piper" | "gpt_sovits";
type BaseTtsProviderId = Exclude<TtsProviderId, "gpt_sovits">;

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

const providerTitle: Record<TtsProviderId, string> = {
  windows_builtin: "内置语音",
  piper_local: "Piper 语音包",
  gpt_sovits: "GPT-SoVITS",
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

const pickNumberOption = (value: string, options: number[], fallback: number) => {
  const next = Number(value);
  if (Number.isFinite(next) && options.includes(next)) {
    return String(next);
  }
  if (options.includes(fallback)) {
    return String(fallback);
  }
  return options[0] !== undefined ? String(options[0]) : String(fallback);
};

const buildGptFormFromCatalog = (
  catalog: GptSovitsCatalog,
  current?: GptSovitsFormState,
): GptSovitsFormState => ({
  promptText: current?.promptText ?? "",
  text:
    current?.text ?? "你好，这里是 UIChat Mira 的 GPT-SoVITS 微应用调试页。",
  promptLanguage: pickStringOption(
    current?.promptLanguage ?? "",
    catalog.languageOptions,
    catalog.defaults.promptLanguage,
  ),
  textLanguage: pickStringOption(
    current?.textLanguage ?? "",
    catalog.languageOptions,
    catalog.defaults.textLanguage,
  ),
  gptModel: pickStringOption(
    current?.gptModel ?? "",
    catalog.gptModelOptions,
    catalog.defaults.gptModel,
  ),
  sovitsModel: pickStringOption(
    current?.sovitsModel ?? "",
    catalog.sovitsModelOptions,
    catalog.defaults.sovitsModel,
  ),
  cutMethod: pickStringOption(
    current?.cutMethod ?? "",
    catalog.cutMethodOptions,
    catalog.defaults.cutMethod,
  ),
  sampleSteps: pickNumberOption(
    current?.sampleSteps ?? "",
    catalog.sampleStepOptions,
    catalog.defaults.sampleSteps,
  ),
  speed: current?.speed ?? String(catalog.defaults.speed),
  pauseSecond: current?.pauseSecond ?? String(catalog.defaults.pauseSecond),
  temperature: current?.temperature ?? String(catalog.defaults.temperature),
  topK: current?.topK ?? String(catalog.defaults.topK),
  topP: current?.topP ?? String(catalog.defaults.topP),
});

export default function TtsStudioPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>("piper");
  const [loading, setLoading] = useState(true);
  const [savingProviderId, setSavingProviderId] = useState<TtsProviderId | "">("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [gptCatalogLoading, setGptCatalogLoading] = useState(false);
  const [providers, setProviders] = useState<TtsProviderConfigRecord[]>([]);
  const [recentJobs, setRecentJobs] = useState<TtsSynthesisJobRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({});
  const [providerId, setProviderId] = useState<BaseTtsProviderId>("windows_builtin");
  const [voices, setVoices] = useState<TtsVoiceSummary[]>([]);
  const [text, setText] = useState("你好，这里是 UIChat Mira 的 TTS 微应用调试页。");
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState("0");
  const [volume, setVolume] = useState("100");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState("");
  const [gptCatalog, setGptCatalog] = useState<GptSovitsCatalog | null>(null);
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
  const [storedRefAudios, setStoredRefAudios] = useState<StoredGptSovitsRefAudio[]>([]);
  const [selectedRefAudioId, setSelectedRefAudioId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedProvider = providers.find((item) => item.providerId === providerId) ?? null;
  const selectedDraft = drafts[providerId] ?? null;
  const selectedGptDraft = drafts.gpt_sovits ?? null;
  const selectedRefAudio =
    storedRefAudios.find((item) => item.id === selectedRefAudioId) ?? null;
  const selectedJob =
    activeTab === "gpt_sovits"
      ? recentJobs.find((item) => item.providerId === "gpt_sovits") ?? null
      : recentJobs.find((item) => item.providerId === providerId) ??
        recentJobs.find((item) => item.providerId !== "gpt_sovits") ??
        null;

  const voiceOptions = useMemo(
    () => [
      {
        value: "",
        label: providerId === "windows_builtin" ? "使用系统默认语音" : "使用当前语音包默认音色",
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
      storedRefAudios.map((item) => ({
        value: item.id,
        label: item.name,
      })),
    [storedRefAudios],
  );

  const loadStoredRefAudios = async () => {
    try {
      const items = await listStoredGptSovitsRefAudios();
      setStoredRefAudios(items);
      setSelectedRefAudioId((current) => {
        if (current && items.some((item) => item.id === current)) {
          return current;
        }
        return items[0]?.id ?? "";
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载参考音频失败");
    }
  };

  const loadOverview = async () => {
    setLoading(true);
    try {
      const overview = await getTtsOverview();
      setProviders(overview.providers);
      setRecentJobs(overview.recentJobs);
      setDrafts(
        Object.fromEntries(
          overview.providers.map((item) => [item.providerId, toDraft(item)]),
        ),
      );
      if (!overview.providers.some((item) => item.providerId === providerId)) {
        setProviderId("windows_builtin");
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 TTS 工作台失败");
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async (nextProviderId: BaseTtsProviderId) => {
    setVoicesLoading(true);
    try {
      const result = await getTtsVoices(nextProviderId);
      setVoices(result.voices);
      setVoice("");
    } catch (error) {
      setVoices([]);
      message.error(error instanceof Error ? error.message : "加载语音列表失败");
    } finally {
      setVoicesLoading(false);
    }
  };

  const loadGptSovits = async () => {
    setGptCatalogLoading(true);
    try {
      const result = await getGptSovitsCatalog();
      setGptCatalog(result.catalog);
      setGptForm((current) => buildGptFormFromCatalog(result.catalog, current));
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 GPT-SoVITS 配置失败");
    } finally {
      setGptCatalogLoading(false);
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
      void loadStoredRefAudios();
    }
  }, [activeTab]);

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
          message.error(error instanceof Error ? error.message : "加载音频预览失败");
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
        enabled: draft.enabled,
        displayName: draft.displayName.trim(),
        config: draft.config,
      });
      message.success("TTS provider 配置已保存");
      await loadOverview();
      await loadVoices(providerId);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 TTS provider 失败");
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
      await updateTtsProvider("gpt_sovits", {
        enabled: true,
        displayName: draft.displayName.trim() || providerTitle.gpt_sovits,
        config: {
          ...(draft.config ?? {}),
          baseUrl: String(draft.config.baseUrl ?? "").trim(),
          gptModel: gptForm.gptModel,
          sovitsModel: gptForm.sovitsModel,
        },
      });
      message.success("GPT-SoVITS 配置已保存");
      await loadOverview();
      await loadGptSovits();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存 GPT-SoVITS 配置失败");
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
        voice: voice || undefined,
        rate: Number(rate),
        volume: Number(volume),
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
    if (!gptForm.promptText.trim()) {
      message.error("请先填写参考文本");
      return;
    }
    if (!gptForm.text.trim()) {
      message.error("请先输入要合成的文本");
      return;
    }
    if (!gptForm.gptModel || !gptForm.sovitsModel) {
      message.error("请先选择 GPT 模型和 SoVITS 模型");
      return;
    }

    setSynthesizing(true);
    try {
      const refAudioFile = toStoredGptSovitsRefAudioFile(selectedRefAudio);
      await createGptSovitsSynthesis({
        text: gptForm.text.trim(),
        refAudioFile,
        promptText: gptForm.promptText.trim(),
        promptLanguage: gptForm.promptLanguage,
        textLanguage: gptForm.textLanguage,
        gptModel: gptForm.gptModel,
        sovitsModel: gptForm.sovitsModel,
        cutMethod: gptForm.cutMethod,
        sampleSteps: Number(gptForm.sampleSteps),
        speed: Number(gptForm.speed),
        pauseSecond: Number(gptForm.pauseSecond),
        temperature: Number(gptForm.temperature),
        topK: Number(gptForm.topK),
        topP: Number(gptForm.topP),
      });
      message.success("语音合成完成");
      await loadOverview();
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
      message.error(error instanceof Error ? error.message : "保存参考音频失败");
    }
  };

  const handleDeleteRefAudio = async (id: string) => {
    try {
      await deleteStoredGptSovitsRefAudio(id);
      await loadStoredRefAudios();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除参考音频失败");
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="MicroAPP"
      title="TTS Studio"
      description="微应用边界内的桌面语音合成工作台。"
      contentClassName="pt-6"
      scrollBody={false}
      slot={
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
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
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pt-6">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold text-text-primary">结果预览</div>
                  {selectedJob ? (
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
                  ) : null}
                </div>

                {!selectedJob ? (
                  <Alert variant="info" title="暂无结果">
                    当前还没有可预览的语音结果。
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="text-text-primary">
                        <span className="font-medium">Provider：</span>
                        {providerTitle[selectedJob.providerId]}
                      </div>
                      <div className="text-text-primary">
                        <span className="font-medium">时间：</span>
                        {selectedJob.createdAt}
                      </div>
                      <div className="text-text-secondary">
                        <span className="font-medium text-text-primary">文本：</span>
                        {selectedJob.text}
                      </div>
                    </div>

                    {selectedJob.errorMessage ? (
                      <Alert variant="warning" title="最近一次失败原因">
                        {selectedJob.errorMessage}
                      </Alert>
                    ) : null}

                    {selectedJob.status === "succeeded" && audioPreviewUrl ? (
                      <audio
                        key={selectedJob.id}
                        controls
                        className="w-full"
                        src={audioPreviewUrl}
                      />
                    ) : (
                      <Alert variant="info" title="当前任务还没有可播放音频">
                        {selectedJob.status === "succeeded"
                          ? "音频预览还在加载，请稍等。"
                          : "只有成功任务才会返回音频产物。"}
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {activeTab === "gpt_sovits" ? (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Waves className="h-5 w-5 text-primary" />
                        GPT-SoVITS 配置
                      </div>

                      {selectedGptDraft ? (
                        <>
                          <TextInput
                            label="服务地址"
                            value={String(selectedGptDraft.config.baseUrl ?? "")}
                            onChange={(value) =>
                              updateProviderConfig("gpt_sovits", "baseUrl", value)
                            }
                            disabled={Boolean(savingProviderId)}
                            placeholder="http://127.0.0.1:9872"
                          />

                          <Select
                            label="GPT 模型"
                            value={gptForm.gptModel}
                            onChange={(value) =>
                              setGptForm((current) => ({ ...current, gptModel: value }))
                            }
                            options={gptModelOptions}
                            disabled={gptCatalogLoading || Boolean(savingProviderId)}
                          />

                          <Select
                            label="SoVITS 模型"
                            value={gptForm.sovitsModel}
                            onChange={(value) =>
                              setGptForm((current) => ({ ...current, sovitsModel: value }))
                            }
                            options={sovitsModelOptions}
                            disabled={gptCatalogLoading || Boolean(savingProviderId)}
                          />

                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              onClick={() => void saveGptProvider()}
                              disabled={Boolean(savingProviderId)}
                            >
                              <Save className="h-4 w-4" />
                              保存 Provider
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Alert variant="info" title="暂无 Provider 配置">
                          当前还没有可用的 GPT-SoVITS 配置。
                        </Alert>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Volume2 className="h-5 w-5 text-primary" />
                        合成请求
                      </div>

                      <div className="space-y-2">
                        <div className="text-xs font-medium text-text-secondary">
                          参考音频文件
                        </div>
                        <div className="flex items-center gap-2">
                          <Select
                            value={selectedRefAudioId}
                            onChange={setSelectedRefAudioId}
                            options={storedRefAudioOptions}
                            disabled={storedRefAudios.length === 0}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="shrink-0 px-2.5"
                          >
                            <Upload className="h-4 w-4" />
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".wav,audio/wav"
                            className="hidden"
                            onChange={handleSelectRefAudioFiles}
                          />
                        </div>

                        {selectedRefAudio ? (
                          <div className="flex items-center gap-2 rounded-ui-control border border-border bg-surface-secondary px-3 py-2">
                            <div className="min-w-0 flex-1 truncate text-sm text-text-primary">
                              {selectedRefAudio.name}
                            </div>
                            <IconButton
                              size="xs"
                              tone="danger"
                              styleType="ghost"
                              ariaLabel="删除参考音频"
                              onClick={() => void handleDeleteRefAudio(selectedRefAudio.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        ) : null}
                      </div>

                      <TextArea
                        label="参考文本"
                        value={gptForm.promptText}
                        onChange={(value) =>
                          setGptForm((current) => ({ ...current, promptText: value }))
                        }
                        rows={4}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Select
                          label="参考语种"
                          value={gptForm.promptLanguage}
                          onChange={(value) =>
                            setGptForm((current) => ({ ...current, promptLanguage: value }))
                          }
                          options={gptLanguageOptions}
                          disabled={gptCatalogLoading}
                        />
                        <Select
                          label="目标语言"
                          value={gptForm.textLanguage}
                          onChange={(value) =>
                            setGptForm((current) => ({ ...current, textLanguage: value }))
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
                            setGptForm((current) => ({ ...current, sampleSteps: value }))
                          }
                          options={sampleStepOptions}
                          disabled={gptCatalogLoading}
                        />
                        <Select
                          label="切割方式"
                          value={gptForm.cutMethod}
                          onChange={(value) =>
                            setGptForm((current) => ({ ...current, cutMethod: value }))
                          }
                          options={cutMethodOptions}
                          disabled={gptCatalogLoading}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <Slider
                          label="语速"
                          labelHelp="范围 0.6 到 1.65"
                          value={Number(gptForm.speed)}
                          min={0.6}
                          max={1.65}
                          step={0.01}
                          onChange={(value) =>
                            setGptForm((current) => ({ ...current, speed: String(value) }))
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
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
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
                            setGptForm((current) => ({ ...current, topK: String(value) }))
                          }
                        />
                        <Slider
                          label="Top P"
                          value={Number(gptForm.topP)}
                          min={0}
                          max={1}
                          step={0.01}
                          onChange={(value) =>
                            setGptForm((current) => ({ ...current, topP: String(value) }))
                          }
                        />
                      </div>

                      <TextArea
                        label="要合成的文本"
                        value={gptForm.text}
                        onChange={(value) =>
                          setGptForm((current) => ({ ...current, text: value }))
                        }
                        rows={8}
                      />

                      <div className="flex justify-end">
                        <Button
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
            ) : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="space-y-4">
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
                        <div className="space-y-4">
                          <Select
                            label="语音来源"
                            value={providerId}
                            onChange={(value) =>
                              setProviderId(
                                ((value as BaseTtsProviderId) || "windows_builtin") as BaseTtsProviderId,
                              )
                            }
                            options={sourceOptions}
                            disabled={loading || providers.length === 0}
                          />

                          <TextInput
                            label="显示名称"
                            value={selectedDraft.displayName}
                            onChange={(value) =>
                              updateProviderMeta(providerId, "displayName", value)
                            }
                            disabled={Boolean(savingProviderId)}
                          />

                          {providerId === "windows_builtin" ? (
                            <>
                              <Select
                                label="默认系统语音"
                                value={String(selectedDraft.config.defaultVoice ?? "")}
                                onChange={(value) =>
                                  updateProviderConfig(providerId, "defaultVoice", value)
                                }
                                options={voiceOptions}
                                disabled={Boolean(savingProviderId) || voicesLoading}
                              />
                              <div className="grid gap-4 sm:grid-cols-2">
                                <TextInput
                                  label="默认语速"
                                  value={String(selectedDraft.config.rate ?? 0)}
                                  onChange={(value) =>
                                    updateProviderConfig(
                                      providerId,
                                      "rate",
                                      Number(value || 0),
                                    )
                                  }
                                  disabled={Boolean(savingProviderId)}
                                />
                                <TextInput
                                  label="默认音量"
                                  value={String(selectedDraft.config.volume ?? 100)}
                                  onChange={(value) =>
                                    updateProviderConfig(
                                      providerId,
                                      "volume",
                                      Number(value || 100),
                                    )
                                  }
                                  disabled={Boolean(savingProviderId)}
                                />
                              </div>
                            </>
                          ) : (
                            <>
                              <TextInput
                                label="语音包文件"
                                value={String(selectedDraft.config.modelPath ?? "")}
                                onChange={(value) =>
                                  updateProviderConfig(providerId, "modelPath", value)
                                }
                                placeholder="例如 C:\\models\\zh_CN-huayan-medium.onnx"
                                disabled={Boolean(savingProviderId)}
                              />
                              <TextInput
                                label="语音包标签"
                                value={String(selectedDraft.config.voiceLabel ?? "")}
                                onChange={(value) =>
                                  updateProviderConfig(providerId, "voiceLabel", value)
                                }
                                placeholder="例如 zh_CN-huayan-medium"
                                disabled={Boolean(savingProviderId)}
                              />
                              <TextInput
                                label="默认 Speaker"
                                value={String(selectedDraft.config.speaker ?? "")}
                                onChange={(value) =>
                                  updateProviderConfig(providerId, "speaker", value)
                                }
                                placeholder="可选，留空表示使用模型默认 speaker"
                                disabled={Boolean(savingProviderId)}
                              />
                            </>
                          )}

                          <div className="flex justify-end">
                            <Button
                              variant="primary"
                              onClick={() => void saveBaseProvider()}
                              disabled={Boolean(savingProviderId)}
                            >
                              <Save className="h-4 w-4" />
                              保存 Provider
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

                <div className="space-y-4">
                  <Card className="p-5">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                        <Volume2 className="h-5 w-5 text-primary" />
                        合成请求
                      </div>

                      <Select
                        label={providerId === "windows_builtin" ? "系统语音" : "语音包音色"}
                        value={voice}
                        onChange={setVoice}
                        options={voiceOptions}
                        disabled={voicesLoading}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextInput
                          label="语速"
                          value={rate}
                          onChange={setRate}
                          placeholder="Windows 建议 -10 到 10"
                        />
                        <TextInput
                          label="音量"
                          value={volume}
                          onChange={setVolume}
                          placeholder="0 到 100"
                        />
                      </div>

                      <TextArea
                        label="要合成的文本"
                        value={text}
                        onChange={setText}
                        rows={8}
                        placeholder="输入一段文本，快速验证桌面 TTS 闭环。"
                      />

                      <div className="flex justify-end">
                        <Button
                          variant="primary"
                          onClick={() => void runBaseSynthesis()}
                          disabled={synthesizing || loading}
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
