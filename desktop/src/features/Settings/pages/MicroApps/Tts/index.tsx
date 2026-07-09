import { useEffect, useMemo, useState } from "react";
import { AudioLines, RefreshCcw, Save, Volume2 } from "lucide-react";
import Card from "@/shared/ui/Card";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import { Button, Select, Switch, TextArea, TextInput } from "@/shared/ui";
import { message } from "@/shared/ui/Message";
import MicroAppPageLayout from "../components/MicroAppPageLayout";
import {
  createTtsSynthesis,
  getTtsAudioUrl,
  getTtsOverview,
  getTtsVoices,
  updateTtsProvider,
  type TtsProviderConfigRecord,
  type TtsProviderId,
  type TtsSynthesisJobRecord,
  type TtsVoiceSummary,
} from "@/shared/api/tts";

type ProviderDraft = {
  enabled: boolean;
  displayName: string;
  config: Record<string, unknown>;
};

const providerTitle: Record<TtsProviderId, string> = {
  windows_builtin: "Windows Built-in Voice",
  piper_local: "Piper Local",
};

const providerNote: Record<TtsProviderId, string> = {
  windows_builtin: "使用 Windows 已安装语音，适合先验证桌面内语音合成闭环。",
  piper_local: "使用本地 piper 可执行文件和语音模型，适合离线 TTS 调试。",
};

const voiceLabel = (voice: TtsVoiceSummary) => voice.label || voice.id;

const toDraft = (provider: TtsProviderConfigRecord): ProviderDraft => ({
  enabled: provider.enabled,
  displayName: provider.displayName,
  config: provider.config,
});

export default function TtsStudioPage() {
  const [loading, setLoading] = useState(true);
  const [savingProviderId, setSavingProviderId] = useState<TtsProviderId | "">("");
  const [synthesizing, setSynthesizing] = useState(false);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [providers, setProviders] = useState<TtsProviderConfigRecord[]>([]);
  const [recentJobs, setRecentJobs] = useState<TtsSynthesisJobRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ProviderDraft>>({});
  const [providerId, setProviderId] = useState<TtsProviderId>("windows_builtin");
  const [voices, setVoices] = useState<TtsVoiceSummary[]>([]);
  const [text, setText] = useState("你好，这里是 UIChat Mira 的 TTS 微应用调试页。");
  const [voice, setVoice] = useState("");
  const [rate, setRate] = useState("0");
  const [volume, setVolume] = useState("100");
  const [selectedJobId, setSelectedJobId] = useState("");

  const selectedProvider = providers.find((item) => item.providerId === providerId) ?? null;
  const selectedDraft = drafts[providerId] ?? null;
  const selectedJob = recentJobs.find((item) => item.id === selectedJobId) ?? recentJobs[0] ?? null;

  const providerOptions = useMemo(
    () =>
      providers.map((item) => ({
        value: item.providerId,
        label: providerTitle[item.providerId],
      })),
    [providers],
  );

  const voiceOptions = useMemo(
    () => [
      {
        value: "",
        label: providerId === "windows_builtin" ? "使用系统默认语音" : "使用当前 Piper 默认语音",
      },
      ...voices.map((item) => ({
        value: item.id,
        label: voiceLabel(item),
      })),
    ],
    [providerId, voices],
  );

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
        setProviderId((overview.providers[0]?.providerId as TtsProviderId | undefined) ?? "windows_builtin");
      }
      if (overview.recentJobs[0]) {
        setSelectedJobId((current) => current || overview.recentJobs[0].id);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 TTS 工作台失败");
    } finally {
      setLoading(false);
    }
  };

  const loadVoices = async (nextProviderId: TtsProviderId) => {
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

  useEffect(() => {
    void loadOverview();
  }, []);

  useEffect(() => {
    void loadVoices(providerId);
  }, [providerId]);

  const updateDraft = (key: string, value: unknown) => {
    setDrafts((current) => ({
      ...current,
      [providerId]: {
        ...(current[providerId] ?? {
          enabled: true,
          displayName: providerTitle[providerId],
          config: {},
        }),
        config: {
          ...(current[providerId]?.config ?? {}),
          [key]: value,
        },
      },
    }));
  };

  const updateDraftMeta = (key: "enabled" | "displayName", value: boolean | string) => {
    setDrafts((current) => ({
      ...current,
      [providerId]: {
        ...(current[providerId] ?? {
          enabled: true,
          displayName: providerTitle[providerId],
          config: {},
        }),
        [key]: value,
      } as ProviderDraft,
    }));
  };

  const saveProvider = async () => {
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

  const runSynthesis = async () => {
    if (!text.trim()) {
      message.error("请先输入要合成的文本");
      return;
    }

    setSynthesizing(true);
    try {
      const result = await createTtsSynthesis({
        providerId,
        text: text.trim(),
        voice: voice || undefined,
        rate: Number(rate),
        volume: Number(volume),
      });
      message.success("语音合成完成");
      await loadOverview();
      setSelectedJobId(result.job.id);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "语音合成失败");
    } finally {
      setSynthesizing(false);
    }
  };

  return (
    <MicroAppPageLayout
      miniTitle="MicroAPP"
      title="TTS Studio"
      description="先在微应用边界内完成桌面语音合成闭环。当前只接 Windows 内置语音和 Piper。"
      contentClassName="pt-6"
      scrollBody={false}
      slot={
        <Button variant="outline" size="sm" onClick={() => void loadOverview()} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      }
    >
      <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AudioLines className="h-5 w-5 text-primary" />
                      <div className="text-base font-semibold text-text-primary">Provider 配置</div>
                    </div>
                    <div className="text-sm leading-6 text-text-secondary">
                      这里不走 model 设置，只在 TTS 微应用内部维护合成 provider 配置。
                    </div>
                  </div>
                  <Badge variant="primary" size="sm">
                    MicroAPP
                  </Badge>
                </div>

                <Select
                  label="当前 Provider"
                  value={providerId}
                  onChange={(value) => setProviderId((value as TtsProviderId) || "windows_builtin")}
                  options={providerOptions}
                  disabled={loading || providers.length === 0}
                />

                {selectedProvider && selectedDraft ? (
                  <div className="space-y-4">
                    <Alert variant="info" title={providerTitle[selectedProvider.providerId]}>
                      {providerNote[selectedProvider.providerId]}
                    </Alert>

                    <div className="flex items-center justify-between rounded-ui-panel border border-border bg-surface-secondary/20 px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">启用当前 Provider</div>
                        <div className="text-xs text-text-tertiary">关闭后，这个 provider 不会参与合成。</div>
                      </div>
                      <Switch
                        checked={selectedDraft.enabled}
                        onChange={() => updateDraftMeta("enabled", !selectedDraft.enabled)}
                        ariaLabel="启用当前 TTS provider"
                        disabled={Boolean(savingProviderId)}
                      />
                    </div>

                    <TextInput
                      label="显示名称"
                      value={selectedDraft.displayName}
                      onChange={(value) => updateDraftMeta("displayName", value)}
                      disabled={Boolean(savingProviderId)}
                    />

                    {providerId === "windows_builtin" ? (
                      <>
                        <TextInput
                          label="默认语音"
                          value={String(selectedDraft.config.defaultVoice ?? "")}
                          onChange={(value) => updateDraft("defaultVoice", value)}
                          placeholder="留空表示跟随系统默认语音"
                          disabled={Boolean(savingProviderId)}
                        />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextInput
                            label="默认语速"
                            value={String(selectedDraft.config.rate ?? 0)}
                            onChange={(value) => updateDraft("rate", Number(value || 0))}
                            disabled={Boolean(savingProviderId)}
                          />
                          <TextInput
                            label="默认音量"
                            value={String(selectedDraft.config.volume ?? 100)}
                            onChange={(value) => updateDraft("volume", Number(value || 100))}
                            disabled={Boolean(savingProviderId)}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <TextInput
                          label="Piper 可执行文件路径"
                          value={String(selectedDraft.config.executablePath ?? "")}
                          onChange={(value) => updateDraft("executablePath", value)}
                          placeholder="例如 C:\\tools\\piper\\piper.exe"
                          disabled={Boolean(savingProviderId)}
                        />
                        <TextInput
                          label="Piper 模型路径"
                          value={String(selectedDraft.config.modelPath ?? "")}
                          onChange={(value) => updateDraft("modelPath", value)}
                          placeholder="例如 C:\\models\\zh_CN-huayan-medium.onnx"
                          disabled={Boolean(savingProviderId)}
                        />
                        <TextInput
                          label="默认音色标签"
                          value={String(selectedDraft.config.voiceLabel ?? "")}
                          onChange={(value) => updateDraft("voiceLabel", value)}
                          placeholder="例如 zh_CN-huayan-medium"
                          disabled={Boolean(savingProviderId)}
                        />
                        <TextInput
                          label="默认 Speaker"
                          value={String(selectedDraft.config.speaker ?? "")}
                          onChange={(value) => updateDraft("speaker", value)}
                          placeholder="可选，留空表示使用模型默认 speaker"
                          disabled={Boolean(savingProviderId)}
                        />
                      </>
                    )}

                    <div className="flex justify-end">
                      <Button variant="primary" onClick={() => void saveProvider()} disabled={Boolean(savingProviderId)}>
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

            <Card className="p-5">
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-base font-semibold text-text-primary">
                    <Volume2 className="h-5 w-5 text-primary" />
                    合成请求
                  </div>
                  <div className="text-sm leading-6 text-text-secondary">
                    当前直接走 `/microapps/tts/...`，生成结果统一由 backend 落盘并回放。
                  </div>
                </div>

                <Select
                  label="语音选择"
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

                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs leading-5 text-text-tertiary">
                    当前产物默认写入工作区 `.artifacts/tts/outputs/`，先服务于本地调试闭环。
                  </div>
                  <Button variant="primary" onClick={() => void runSynthesis()} disabled={synthesizing || loading}>
                    {synthesizing ? "合成中..." : "开始合成"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="space-y-4">
                <div className="text-base font-semibold text-text-primary">最近任务</div>
                {recentJobs.length === 0 ? (
                  <Alert variant="info" title="还没有合成记录">
                    先发起一次语音合成，这里会展示最近任务和音频预览。
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {recentJobs.map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => setSelectedJobId(job.id)}
                        className={`w-full rounded-ui-panel border px-4 py-3 text-left transition-colors ${
                          selectedJob?.id === job.id
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-surface-secondary/20 hover:bg-surface-secondary/35"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-text-primary">
                              {job.text}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {providerTitle[job.providerId]} · {job.createdAt}
                            </div>
                          </div>
                          <Badge
                            variant={
                              job.status === "succeeded"
                                ? "success"
                                : job.status === "failed"
                                  ? "danger"
                                  : "warning"
                            }
                            size="sm"
                          >
                            {job.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="space-y-4">
                <div className="text-base font-semibold text-text-primary">结果预览</div>
                {!selectedJob ? (
                  <Alert variant="info" title="暂无结果">
                    当前没有可预览的语音结果。
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="text-text-primary">
                        <span className="font-medium">Provider：</span>
                        {providerTitle[selectedJob.providerId]}
                      </div>
                      <div className="text-text-primary">
                        <span className="font-medium">状态：</span>
                        {selectedJob.status}
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

                    {selectedJob.status === "succeeded" ? (
                      <audio
                        key={selectedJob.id}
                        controls
                        className="w-full"
                        src={getTtsAudioUrl(selectedJob.id)}
                      />
                    ) : (
                      <Alert variant="info" title="当前任务还没有可播放音频">
                        只有成功任务才会返回音频产物。
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MicroAppPageLayout>
  );
}
