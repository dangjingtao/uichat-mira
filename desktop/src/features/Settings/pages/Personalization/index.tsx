import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Brain, Pencil, Trash2 } from "lucide-react";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import {
  Button,
  Drawer,
  IconButton,
  Select,
  Switch,
  TextArea,
  TextInput,
} from "@/shared/ui";
import SectionCard, { SectionCardRow } from "@/shared/ui/SectionCard";
import {
  createMemory,
  deleteMemory,
  getMemoryOverview,
  updateMemory,
  updateMemorySettings,
  type MemoryKind,
  type MemoryOverview,
  type MemoryRecord,
} from "@/shared/api/memory";

type TonePreset = "friendly" | "professional" | "concise" | "direct";

const DEFAULT_MEMORY_KIND: MemoryKind = "preference";

export default function PersonalizationSettings() {
  const { t } = useTranslation();
  const [tone, setTone] = useState<TonePreset>("friendly");
  const [customInstructions, setCustomInstructions] = useState("");
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [details, setDetails] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryRecords, setMemoryRecords] = useState<MemoryRecord[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState("");
  const [memoryDrawerOpen, setMemoryDrawerOpen] = useState(false);
  const [memoryDraft, setMemoryDraft] = useState("");
  const [memoryKind, setMemoryKind] =
    useState<MemoryKind>(DEFAULT_MEMORY_KIND);
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);

  const toneOptions = useMemo(
    () =>
      (["friendly", "professional", "concise", "direct"] as const).map(
        (value) => ({
          value,
          label: t(`settings.personalization.tone.options.${value}`),
        }),
      ),
    [t],
  );

  const memoryKindOptions = useMemo(
    () =>
      (["preference", "fact", "decision", "constraint"] as const).map(
        (value) => ({
          value,
          label: t(`settings.personalization.memory.kinds.${value}`, {
            defaultValue:
              value === "preference"
                ? "偏好"
                : value === "fact"
                  ? "长期事实"
                  : value === "decision"
                    ? "决定"
                    : "约束",
          }),
        }),
      ),
    [t],
  );

  const applyMemoryOverview = useCallback((overview: MemoryOverview) => {
    setMemoryEnabled(overview.enabled);
    setMemoryRecords(overview.records);
    setMemoryError("");
  }, []);

  const loadMemory = useCallback(async () => {
    setMemoryLoading(true);
    try {
      applyMemoryOverview(await getMemoryOverview());
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemoryLoading(false);
    }
  }, [applyMemoryOverview]);

  useEffect(() => {
    void loadMemory();
  }, [loadMemory]);

  const resetMemoryEditor = useCallback(() => {
    setEditingMemoryId(null);
    setMemoryDraft("");
    setMemoryKind(DEFAULT_MEMORY_KIND);
  }, []);

  const handleMemoryToggle = async () => {
    const nextEnabled = !memoryEnabled;
    setMemoryEnabled(nextEnabled);
    setMemorySaving(true);
    try {
      applyMemoryOverview(await updateMemorySettings(nextEnabled));
      if (!nextEnabled) {
        setMemoryDrawerOpen(false);
        resetMemoryEditor();
      }
    } catch (error) {
      setMemoryEnabled(!nextEnabled);
      setMemoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemorySaving(false);
    }
  };

  const handleSaveMemory = async () => {
    const content = memoryDraft.trim();
    if (content.length < 4 || memorySaving) return;

    setMemorySaving(true);
    try {
      const overview = editingMemoryId
        ? await updateMemory(editingMemoryId, {
            kind: memoryKind,
            content,
          })
        : await createMemory({
            kind: memoryKind,
            content,
          });
      applyMemoryOverview(overview);
      resetMemoryEditor();
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemorySaving(false);
    }
  };

  const handleEditMemory = (record: MemoryRecord) => {
    setEditingMemoryId(record.id);
    setMemoryKind(record.kind);
    setMemoryDraft(record.content);
  };

  const handleDeleteMemory = async (id: string) => {
    if (memorySaving) return;
    setMemorySaving(true);
    try {
      applyMemoryOverview(await deleteMemory(id));
      if (editingMemoryId === id) resetMemoryEditor();
    } catch (error) {
      setMemoryError(error instanceof Error ? error.message : String(error));
    } finally {
      setMemorySaving(false);
    }
  };

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("settings.personalization.page.miniTitle")}
        title={t("settings.personalization.page.title")}
        description={t("settings.personalization.page.description")}
        contentClassName="space-y-4 pt-6"
        contentMode="flow"
      >
        <SectionCard
          title={t("settings.personalization.communication.title")}
          icon={<Brain className="h-4 w-4" />}
          divided
        >
          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.tone.label")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.tone.description")}
              </div>
            </div>
            <div className="w-full max-w-[190px] shrink-0">
              <Select
                value={tone}
                onChange={(value) => setTone(value as TonePreset)}
                options={toneOptions}
                compact
              />
            </div>
          </SectionCardRow>

          <div className="p-4">
            <TextArea
              label={t("settings.personalization.instructions.label")}
              value={customInstructions}
              onChange={setCustomInstructions}
              placeholder={t(
                "settings.personalization.instructions.placeholder",
              )}
              rows={4}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("settings.personalization.aboutYou.title")}
          contentClassName="grid gap-4 p-4 md:grid-cols-2"
        >
          <TextInput
            label={t("settings.personalization.aboutYou.nickname")}
            value={nickname}
            onChange={setNickname}
            placeholder={t(
              "settings.personalization.aboutYou.nicknamePlaceholder",
            )}
          />
          <TextInput
            label={t("settings.personalization.aboutYou.occupation")}
            value={occupation}
            onChange={setOccupation}
            placeholder={t(
              "settings.personalization.aboutYou.occupationPlaceholder",
            )}
          />
          <div className="md:col-span-2">
            <TextArea
              label={t("settings.personalization.aboutYou.details")}
              value={details}
              onChange={setDetails}
              placeholder={t(
                "settings.personalization.aboutYou.detailsPlaceholder",
              )}
              rows={3}
            />
          </div>
        </SectionCard>

        <SectionCard
          title={t("settings.personalization.memory.title")}
          icon={<Brain className="h-4 w-4" />}
          meta={
            <span>
              {memoryLoading
                ? t("settings.personalization.memory.loading", {
                    defaultValue: "正在读取",
                  })
                : t("settings.personalization.memory.recordCount", {
                    count: memoryRecords.length,
                    defaultValue: `${memoryRecords.length} 条记忆`,
                  })}
            </span>
          }
          divided
        >
          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.memory.enable")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.memory.enableDescription")}
              </div>
            </div>
            <Switch
              checked={memoryEnabled}
              onChange={() => void handleMemoryToggle()}
              disabled={memoryLoading || memorySaving}
              ariaLabel={t("settings.personalization.memory.enable")}
            />
          </SectionCardRow>

          <SectionCardRow>
            <div className="min-w-0">
              <div className="text-sm font-medium text-text-primary">
                {t("settings.personalization.memory.summary")}
              </div>
              <div className="mt-0.5 max-w-2xl text-xs leading-5 text-text-secondary">
                {t("settings.personalization.memory.summaryDescription")}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setMemoryDrawerOpen(true)}
              disabled={!memoryEnabled || memoryLoading}
            >
              {t("settings.personalization.memory.manage")}
            </Button>
          </SectionCardRow>

          {memoryError ? (
            <div className="border-t border-border px-4 py-3 text-xs text-danger-text">
              {memoryError}
            </div>
          ) : null}
        </SectionCard>
      </SettingsPageLayout>

      <Drawer
        open={memoryDrawerOpen}
        onClose={() => setMemoryDrawerOpen(false)}
        width={620}
        closeLabel={t("settings.personalization.memory.close")}
        header={
          <div>
            <div className="text-base font-semibold text-text-primary">
              {t("settings.personalization.memory.drawerTitle")}
            </div>
            <div className="mt-1 text-xs text-text-tertiary">
              {t("settings.personalization.memory.drawerLiveDescription", {
                defaultValue: "这里显示 Mira 当前实际使用的长期记忆。",
              })}
            </div>
          </div>
        }
        footer={
          <Button onClick={() => setMemoryDrawerOpen(false)}>
            {t("settings.personalization.memory.done")}
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="rounded-ui-panel border border-border bg-surface-secondary p-4">
            <div className="text-sm font-semibold text-text-primary">
              {t("settings.personalization.memory.overviewTitle")}
            </div>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              {t("settings.personalization.memory.overviewDescription")}
            </p>
          </div>

          <div className="space-y-2">
            {memoryRecords.length === 0 ? (
              <div className="rounded-ui-panel border border-dashed border-border px-4 py-8 text-center text-sm text-text-tertiary">
                {t("settings.personalization.memory.empty", {
                  defaultValue: "还没有长期记忆。",
                })}
              </div>
            ) : (
              memoryRecords.map((record) => (
                <div
                  key={record.id}
                  className="rounded-ui-panel border border-border bg-surface-primary p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                        <span>
                          {t(
                            `settings.personalization.memory.kinds.${record.kind}`,
                            {
                              defaultValue: record.kind,
                            },
                          )}
                        </span>
                        <span>·</span>
                        <span>
                          {record.origin === "manual"
                            ? t("settings.personalization.memory.manualOrigin", {
                                defaultValue: "手工维护",
                              })
                            : t(
                                "settings.personalization.memory.conversationOrigin",
                                { defaultValue: "对话沉淀" },
                              )}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-text-primary">
                        {record.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <IconButton
                        size="sm"
                        ariaLabel={t("settings.personalization.memory.edit", {
                          defaultValue: "编辑记忆",
                        })}
                        onClick={() => handleEditMemory(record)}
                        disabled={memorySaving}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        tone="danger"
                        ariaLabel={t("settings.personalization.memory.delete", {
                          defaultValue: "删除记忆",
                        })}
                        onClick={() => void handleDeleteMemory(record.id)}
                        disabled={memorySaving}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="w-full max-w-[220px]">
              <Select
                value={memoryKind}
                onChange={(value) => setMemoryKind(value as MemoryKind)}
                options={memoryKindOptions}
                compact
              />
            </div>
            <TextArea
              label={
                editingMemoryId
                  ? t("settings.personalization.memory.editLabel", {
                      defaultValue: "修改记忆",
                    })
                  : t("settings.personalization.memory.updateLabel")
              }
              value={memoryDraft}
              onChange={setMemoryDraft}
              placeholder={t(
                "settings.personalization.memory.updatePlaceholder",
              )}
              rows={3}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-text-tertiary">
                {t("settings.personalization.memory.liveUpdateHint", {
                  defaultValue: "保存后会立即用于后续 Chat 与 Agent 对话。",
                })}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {editingMemoryId ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={resetMemoryEditor}
                    disabled={memorySaving}
                  >
                    {t("settings.personalization.memory.cancelEdit", {
                      defaultValue: "取消",
                    })}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => void handleSaveMemory()}
                  disabled={memoryDraft.trim().length < 4 || memorySaving}
                >
                  {editingMemoryId
                    ? t("settings.personalization.memory.saveEdit", {
                        defaultValue: "保存修改",
                      })
                    : t("settings.personalization.memory.add", {
                        defaultValue: "添加记忆",
                      })}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
