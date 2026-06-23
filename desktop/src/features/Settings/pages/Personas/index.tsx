import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import {
  Bot,
  BookOpenText,
  ChevronRight,
  CircleUserRound,
  ClipboardList,
  Globe2,
  MessagesSquare,
  PenLine,
  Plus,
  Sparkles,
  SquarePen,
  ShieldAlert,
  Trash2,
  User,
  UserRoundPen,
} from "lucide-react";
import { getBuiltinAvatarPack16Options } from "@/shared/avatars";
import Badge from "@/shared/ui/Badge";
import { Button, IconButton } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import CodeBlock from "@/shared/ui/CodeBlock";
import Drawer from "@/shared/ui/Drawer";
import ExpandableSection from "@/shared/ui/ExpandableSection";
import { TextInput } from "@/shared/ui/Input";
import MarkdownEditor from "@/shared/ui/MarkdownEditor";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import Alert from "@/shared/ui/Alert";
import AvatarPicker from "@/shared/ui/AvatarPicker";

type PersonaMode = "chat" | "rag";
type RoleStatus = "default" | "active" | "draft";
type RoleField =
  | "worldview"
  | "persona"
  | "scenario"
  | "exampleDialogues"
  | "style"
  | "constraints";

type RoleDraft = {
  worldview: string;
  persona: string;
  scenario: string;
  exampleDialogues: string;
  style: string;
  constraints: string;
};

type RoleRecord = {
  id: string;
  name: string;
  summary: string;
  avatarId: string | null;
  status: RoleStatus;
  tags: string[];
  prompt: RoleDraft;
};

const ROLE_FIELDS: RoleField[] = [
  "worldview",
  "persona",
  "scenario",
  "exampleDialogues",
  "style",
  "constraints",
];

const FIELD_META: Record<
  RoleField,
  { icon: ComponentType<{ className?: string }> }
> = {
  worldview: { icon: Globe2 },
  persona: { icon: User },
  scenario: { icon: BookOpenText },
  exampleDialogues: { icon: MessagesSquare },
  style: { icon: PenLine },
  constraints: { icon: ShieldAlert },
};

function SectionTitle({
  icon: Icon,
  title,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
        <Icon className="h-4 w-4 shrink-0 text-icon-secondary" />
        <span className="truncate">{title}</span>
      </div>
      {hint ? (
        <div className="text-xs leading-5 text-text-secondary">{hint}</div>
      ) : null}
    </div>
  );
}

function statusTone(status: RoleStatus) {
  if (status === "draft") return "muted" as const;
  return "primary" as const;
}

function isDraftStatus(status: RoleStatus) {
  return status === "draft";
}

function getStatusLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  status: RoleStatus,
) {
  if (!isDraftStatus(status)) {
    return t("settings.roles.status.published");
  }
  return t("settings.roles.status.draft");
}

function buildStarterRoles(
  t: (key: string, options?: Record<string, unknown>) => string,
): RoleRecord[] {
  return [
    {
      id: "formal-reviewer",
      name: t("settings.roles.presets.formalReviewer.name"),
      summary: t("settings.roles.presets.formalReviewer.summary"),
      avatarId: "formal-reviewer",
      status: "default",
      tags: [
        t("settings.roles.presets.formalReviewer.tags.strict"),
        t("settings.roles.presets.formalReviewer.tags.concise"),
        t("settings.roles.presets.formalReviewer.tags.structured"),
      ],
      prompt: {
        worldview: t("settings.roles.presets.formalReviewer.prompt.worldview"),
        persona: t("settings.roles.presets.formalReviewer.prompt.persona"),
        scenario: t("settings.roles.presets.formalReviewer.prompt.scenario"),
        exampleDialogues: t(
          "settings.roles.presets.formalReviewer.prompt.exampleDialogues",
        ),
        style: t("settings.roles.presets.formalReviewer.prompt.style"),
        constraints: t(
          "settings.roles.presets.formalReviewer.prompt.constraints",
        ),
      },
    },
    {
      id: "pilot-helper",
      name: t("settings.roles.presets.pilotHelper.name"),
      summary: t("settings.roles.presets.pilotHelper.summary"),
      avatarId: "pilot-helper",
      status: "active",
      tags: [
        t("settings.roles.presets.pilotHelper.tags.collaborative"),
        t("settings.roles.presets.pilotHelper.tags.clear"),
        t("settings.roles.presets.pilotHelper.tags.light"),
      ],
      prompt: {
        worldview: t("settings.roles.presets.pilotHelper.prompt.worldview"),
        persona: t("settings.roles.presets.pilotHelper.prompt.persona"),
        scenario: t("settings.roles.presets.pilotHelper.prompt.scenario"),
        exampleDialogues: t(
          "settings.roles.presets.pilotHelper.prompt.exampleDialogues",
        ),
        style: t("settings.roles.presets.pilotHelper.prompt.style"),
        constraints: t("settings.roles.presets.pilotHelper.prompt.constraints"),
      },
    },
    {
      id: "archive-guide",
      name: t("settings.roles.presets.archiveGuide.name"),
      summary: t("settings.roles.presets.archiveGuide.summary"),
      avatarId: "archive-guide",
      status: "draft",
      tags: [
        t("settings.roles.presets.archiveGuide.tags.archive"),
        t("settings.roles.presets.archiveGuide.tags.retrieval"),
        t("settings.roles.presets.archiveGuide.tags.order"),
      ],
      prompt: {
        worldview: t("settings.roles.presets.archiveGuide.prompt.worldview"),
        persona: t("settings.roles.presets.archiveGuide.prompt.persona"),
        scenario: t("settings.roles.presets.archiveGuide.prompt.scenario"),
        exampleDialogues: t(
          "settings.roles.presets.archiveGuide.prompt.exampleDialogues",
        ),
        style: t("settings.roles.presets.archiveGuide.prompt.style"),
        constraints: t(
          "settings.roles.presets.archiveGuide.prompt.constraints",
        ),
      },
    },
  ];
}

function createBlankRole(
  t: (key: string, options?: Record<string, unknown>) => string,
  id: string,
): RoleRecord {
  return {
    id,
    name: t("settings.roles.defaults.newName"),
    summary: t("settings.roles.defaults.newSummary"),
    avatarId: null,
    status: "draft",
    tags: [
      t("settings.roles.defaults.newTag1"),
      t("settings.roles.defaults.newTag2"),
    ],
    prompt: {
      worldview: t("settings.roles.defaults.newWorldview"),
      persona: t("settings.roles.defaults.newPersona"),
      scenario: t("settings.roles.defaults.newScenario"),
      exampleDialogues: t("settings.roles.defaults.newExampleDialogues"),
      style: t("settings.roles.defaults.newStyle"),
      constraints: t("settings.roles.defaults.newConstraints"),
    },
  };
}

function RoleAvatar({
  src,
  name,
  sizeClassName,
}: {
  src?: string | null;
  name: string;
  sizeClassName: string;
}) {
  if (!src) {
    return (
      <div
        className={`flex items-center justify-center rounded-full border border-border bg-surface-secondary text-icon-secondary ${sizeClassName}`}
      >
        <CircleUserRound className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={`rounded-full border border-border bg-surface-secondary object-cover ${sizeClassName}`}
      draggable={false}
    />
  );
}

function RoleCard({
  role,
  active,
  onSelect,
  t,
  avatarSrc,
}: {
  role: RoleRecord;
  active: boolean;
  onSelect: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
  avatarSrc?: string | null;
}) {
  const showDraftBadge = isDraftStatus(role.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-ui-panel border p-3.5 text-left transition-colors ${
        active
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-surface-primary hover:bg-surface-secondary"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-2">
          <RoleAvatar
            src={avatarSrc}
            name={role.name}
            sizeClassName="h-10 w-10 shrink-0"
          />
          {showDraftBadge ? (
            <Badge variant={statusTone(role.status)}>{getStatusLabel(t, role.status)}</Badge>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-text-primary">
              {role.name}
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              {role.summary}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {role.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="neutral">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  );
}

function summarizeField(value: string, emptyText: string) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return emptyText;
  }

  return compact.length > 96 ? `${compact.slice(0, 96).trim()}...` : compact;
}

function estimateTokenCount(value: string) {
  const compact = value.trim();
  if (!compact) {
    return 0;
  }

  const cjkMatches = compact.match(/[\u4e00-\u9fff]/g) ?? [];
  const latinMatches =
    compact
      .replace(/[\u4e00-\u9fff]/g, " ")
      .match(/[A-Za-z0-9_]+/g) ?? [];

  return Math.max(
    1,
    Math.round(cjkMatches.length * 1.1 + latinMatches.join(" ").length / 4),
  );
}

export default function RoleSettings() {
  const { t } = useTranslation();
  const avatarOptions = useMemo(() => getBuiltinAvatarPack16Options(), []);
  const initialRoles = useMemo(() => buildStarterRoles(t), [t]);
  const [roles, setRoles] = useState<RoleRecord[]>(initialRoles);
  const [selectedRoleId, setSelectedRoleId] = useState(
    initialRoles[0]?.id ?? "",
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<PersonaMode>("chat");
  const [testInput, setTestInput] = useState(
    t("settings.roles.defaults.previewInput"),
  );
  const [draftWorldview, setDraftWorldview] = useState("");
  const [draftPersona, setDraftPersona] = useState("");
  const [draftScenario, setDraftScenario] = useState("");
  const [draftExampleDialogues, setDraftExampleDialogues] = useState("");
  const [draftStyle, setDraftStyle] = useState("");
  const [draftConstraints, setDraftConstraints] = useState("");
  const [draftAvatarId, setDraftAvatarId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [activeField, setActiveField] = useState<RoleField | null>(null);
  const [fieldEditorValue, setFieldEditorValue] = useState("");
  const [fieldEditorKey, setFieldEditorKey] = useState(0);

  const selectedRole = useMemo(
    () => roles.find((item) => item.id === selectedRoleId) ?? roles[0] ?? null,
    [roles, selectedRoleId],
  );
  const avatarSrcMap = useMemo(
    () => new Map(avatarOptions.map((option) => [option.id, option.src])),
    [avatarOptions],
  );

  const draftValues: Record<RoleField, string> = {
    worldview: draftWorldview,
    persona: draftPersona,
    scenario: draftScenario,
    exampleDialogues: draftExampleDialogues,
    style: draftStyle,
    constraints: draftConstraints,
  };

  const draftSetters: Record<RoleField, (value: string) => void> = {
    worldview: setDraftWorldview,
    persona: setDraftPersona,
    scenario: setDraftScenario,
    exampleDialogues: setDraftExampleDialogues,
    style: setDraftStyle,
    constraints: setDraftConstraints,
  };

  useEffect(() => {
    if (!selectedRole) {
      return;
    }

    setDraftName(selectedRole.name);
    setDraftSummary(selectedRole.summary);
    setDraftAvatarId(selectedRole.avatarId);
    setDraftWorldview(selectedRole.prompt.worldview);
    setDraftPersona(selectedRole.prompt.persona);
    setDraftScenario(selectedRole.prompt.scenario);
    setDraftExampleDialogues(selectedRole.prompt.exampleDialogues);
    setDraftStyle(selectedRole.prompt.style);
    setDraftConstraints(selectedRole.prompt.constraints);
    setActiveField(null);
  }, [selectedRole]);

  useEffect(() => {
    setRoles(buildStarterRoles(t));
  }, [t]);

  const isEdited =
    selectedRole?.avatarId !== draftAvatarId ||
    selectedRole?.name !== draftName ||
    selectedRole?.summary !== draftSummary ||
    selectedRole?.prompt.worldview !== draftWorldview ||
    selectedRole?.prompt.persona !== draftPersona ||
    selectedRole?.prompt.scenario !== draftScenario ||
    selectedRole?.prompt.exampleDialogues !== draftExampleDialogues ||
    selectedRole?.prompt.style !== draftStyle ||
    selectedRole?.prompt.constraints !== draftConstraints;

  const updateRole = (updater: (role: RoleRecord) => RoleRecord) => {
    if (!selectedRole) {
      return;
    }

    setRoles((current) =>
      current.map((role) =>
        role.id === selectedRole.id ? updater(role) : role,
      ),
    );
  };

  const openFieldDrawer = (field: RoleField) => {
    setActiveField(field);
    setFieldEditorValue(draftValues[field]);
    setFieldEditorKey((current) => current + 1);
  };

  const resetFieldEditor = () => {
    if (!activeField) {
      return;
    }

    setFieldEditorValue(draftValues[activeField]);
    setFieldEditorKey((current) => current + 1);
  };

  const handleSaveField = () => {
    if (!activeField) {
      return;
    }

    draftSetters[activeField](fieldEditorValue.trim());
    setActiveField(null);
  };

  const handleNewRole = () => {
    const nextRole = createBlankRole(t, `role-${crypto.randomUUID()}`);
    setRoles((current) => [nextRole, ...current]);
    setSelectedRoleId(nextRole.id);
    message.info(t("settings.roles.messages.created"));
  };

  const handleImportRole = () => {
    if (!selectedRole) {
      return;
    }

    const imported = {
      ...selectedRole,
      id: `role-${crypto.randomUUID()}`,
      name: `${selectedRole.name}${t("settings.roles.actions.copySuffix")}`,
      status: "draft" as const,
    };

    setRoles((current) => [imported, ...current]);
    setSelectedRoleId(imported.id);
    message.success(t("settings.roles.messages.imported"));
  };

  const resetDraft = () => {
    if (!selectedRole) {
      return;
    }

    setDraftName(selectedRole.name);
    setDraftSummary(selectedRole.summary);
    setDraftAvatarId(selectedRole.avatarId);
    setDraftWorldview(selectedRole.prompt.worldview);
    setDraftPersona(selectedRole.prompt.persona);
    setDraftScenario(selectedRole.prompt.scenario);
    setDraftExampleDialogues(selectedRole.prompt.exampleDialogues);
    setDraftStyle(selectedRole.prompt.style);
    setDraftConstraints(selectedRole.prompt.constraints);
    setActiveField(null);
    message.info(t("settings.roles.messages.reset"));
  };

  const handleSave = () => {
    if (!selectedRole) {
      return;
    }

    updateRole((role) => ({
      ...role,
      name: draftName.trim() || role.name,
      summary: draftSummary.trim() || role.summary,
      avatarId: draftAvatarId,
      status: role.status === "default" ? "default" : "active",
      prompt: {
        worldview: draftWorldview.trim(),
        persona: draftPersona.trim(),
        scenario: draftScenario.trim(),
        exampleDialogues: draftExampleDialogues.trim(),
        style: draftStyle.trim(),
        constraints: draftConstraints.trim(),
      },
    }));
    message.success(t("settings.roles.messages.saved"));
  };

  const handleDelete = () => {
    if (!selectedRole) {
      return;
    }

    Modal.confirm({
      title: t("settings.roles.deleteModal.title"),
      description: t("settings.roles.deleteModal.description", {
        name: selectedRole.name,
      }),
      tone: "danger",
      confirmText: t("settings.roles.deleteModal.confirm"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        setRoles((current) => {
          const next = current.filter((role) => role.id !== selectedRole.id);
          if (
            next.length > 0 &&
            !next.some((role) => role.id === selectedRoleId)
          ) {
            setSelectedRoleId(next[0].id);
          }
          return next;
        });
        message.success(
          t("settings.roles.messages.deleted", { name: selectedRole.name }),
        );
      },
    });
  };

  const previewPrompt = useMemo(() => {
    const knowledgeBlock =
      previewMode === "rag"
        ? t("settings.roles.preview.knowledgeInjected")
        : t("settings.roles.preview.knowledgeSkipped");

    return `${t("settings.roles.preview.blockTitle")}

[${t("settings.roles.preview.layers.system")}]
${t("settings.roles.preview.systemPrompt")}

[${t("settings.roles.preview.layers.role")}]
${t("settings.roles.preview.roleName")}: ${selectedRole?.name ?? "-"}
${t("settings.roles.preview.roleSummary")}: ${selectedRole?.summary ?? "-"}
${t("settings.roles.preview.roleWorldview")}: ${draftWorldview}
${t("settings.roles.preview.rolePersona")}: ${draftPersona}
${t("settings.roles.preview.roleScenario")}: ${draftScenario}
${t("settings.roles.preview.roleExamples")}: ${draftExampleDialogues}
${t("settings.roles.preview.roleStyle")}: ${draftStyle}
${t("settings.roles.preview.roleConstraints")}: ${draftConstraints}

[${t("settings.roles.preview.layers.knowledge")}]
${knowledgeBlock}

[${t("settings.roles.preview.layers.history")}]
${t("settings.roles.preview.historyNotice")}
${t("settings.roles.preview.input")}: ${testInput}`;
  }, [
    draftConstraints,
    draftExampleDialogues,
    draftPersona,
    draftScenario,
    draftStyle,
    draftWorldview,
    previewMode,
    selectedRole,
    t,
    testInput,
  ]);

  const activeFieldDescription = activeField
    ? t(`settings.roles.guide.${activeField}.description`)
    : "";
  const activeFieldNote = activeField
    ? t(`settings.roles.fieldNotes.${activeField}`)
    : "";
  const activeFieldSyntax = activeField
    ? t(`settings.roles.fieldExamples.${activeField}.syntax`)
    : "";
  const activeFieldGood = activeField
    ? t(`settings.roles.fieldExamples.${activeField}.good`)
    : "";
  const activeFieldBad = activeField
    ? t(`settings.roles.fieldExamples.${activeField}.bad`)
    : "";

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("settings.navigation.roles")}
        title={t("settings.roles.page.title")}
        description={t("settings.roles.page.description")}
        contentClassName="pt-6"
      >
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3">
          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <div className="border-b border-border px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <SectionTitle
                  icon={CircleUserRound}
                  title={t("settings.roles.list.title")}
                />
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    ariaLabel={t("settings.roles.actions.new")}
                    title={t("settings.roles.actions.new")}
                    size="sm"
                    styleType="ghost"
                    onClick={handleNewRole}
                  >
                    <Plus className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    ariaLabel={t("settings.roles.actions.import")}
                    title={t("settings.roles.actions.import")}
                    size="sm"
                    styleType="ghost"
                    onClick={handleImportRole}
                  >
                    <Sparkles className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3.5">
              {roles.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  active={role.id === selectedRoleId}
                  onSelect={() => setSelectedRoleId(role.id)}
                  t={t}
                  avatarSrc={role.avatarId ? avatarSrcMap.get(role.avatarId) : null}
                />
              ))}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden p-0">
            <div className="border-b border-border px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <SectionTitle
                  icon={UserRoundPen}
                  title={t("settings.roles.editor.title")}
                  hint={t("settings.roles.editor.hint")}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={statusTone(selectedRole?.status ?? "draft")}>
                    {selectedRole
                      ? getStatusLabel(t, selectedRole.status)
                      : "-"}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    onClick={() => setPreviewOpen(true)}
                  >
                    <Bot className="h-4 w-4" />
                    {t("settings.roles.actions.preview")}
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex flex-1 flex-col">
              <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto p-3.5">
                <div className="space-y-5 pb-3.5">
                <AvatarPicker
                  label={t("ui.avatarPicker.title")}
                  hint={t("ui.avatarPicker.triggerHint")}
                  value={draftAvatarId}
                  options={avatarOptions}
                  onChange={(option) => setDraftAvatarId(option.id)}
                  onClear={() => setDraftAvatarId(null)}
                  allowClear
                />

                <div className="grid gap-3 xl:grid-cols-2">
                  <TextInput
                    label={t("settings.roles.form.name")}
                    value={draftName}
                    onChange={setDraftName}
                  />
                  <TextInput
                    label={t("settings.roles.form.summary")}
                    value={draftSummary}
                    onChange={setDraftSummary}
                  />
                </div>

                <div className="space-y-3.5 pt-1">
                  <SectionTitle
                    icon={ClipboardList}
                    title={t("settings.roles.fields.title")}
                    hint={t("settings.roles.fields.hint")}
                  />
                  <div className="grid gap-3 xl:grid-cols-2">
                    {ROLE_FIELDS.map((field) => (
                      (() => {
                        const FieldIcon = FIELD_META[field].icon;
                        const tokenCount = estimateTokenCount(draftValues[field]);

                        return (
                          <button
                            key={field}
                            type="button"
                            onClick={() => openFieldDrawer(field)}
                            className="rounded-ui-panel border border-border bg-surface-primary p-3 text-left transition-colors hover:bg-surface-secondary"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex flex-1 items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
                                  <FieldIcon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <div className="truncate text-sm font-semibold text-text-primary">
                                      {t(`settings.roles.form.${field}`)}
                                    </div>
                                    <Badge
                                      variant="neutral"
                                      className="shrink-0 whitespace-nowrap"
                                    >
                                      ~{tokenCount} tok
                                    </Badge>
                                  </div>
                                  <div className="truncate text-xs leading-5 text-text-secondary">
                                    {summarizeField(
                                      draftValues[field],
                                      t("settings.roles.fields.empty"),
                                    )}
                                  </div>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 shrink-0 text-icon-secondary" />
                            </div>
                          </button>
                        );
                      })()
                    ))}
                  </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-border bg-surface-primary px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <IconButton
                    ariaLabel={t("settings.roles.actions.delete")}
                    onClick={handleDelete}
                    styleType="ghost"
                    tone="danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={resetDraft}
                    disabled={!isEdited}
                  >
                    {t("common.actions.reset")}
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={!isEdited}>
                    {t("common.actions.save")}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </SettingsPageLayout>

      <Drawer
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={720}
        closeLabel={t("settings.roles.preview.close")}
        closeMaskLabel={t("settings.roles.preview.closeMask")}
        header={
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Bot className="h-4 w-4 text-icon-secondary" />
              {t("settings.roles.preview.title")}
            </div>
            <div className="text-xs leading-5 text-text-secondary">
              {t("settings.roles.preview.hint")}
            </div>
          </div>
        }
        footer={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPreviewMode("chat")}
            >
              {t("settings.roles.preview.chat")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPreviewMode("rag")}
            >
              {t("settings.roles.preview.rag")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode("chat")}
              className={`rounded-ui-control border px-3 py-2 text-left text-sm font-medium transition-colors ${
                previewMode === "chat"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border bg-surface-secondary text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              {t("settings.roles.preview.chat")}
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode("rag")}
              className={`rounded-ui-control border px-3 py-2 text-left text-sm font-medium transition-colors ${
                previewMode === "rag"
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border bg-surface-secondary text-text-secondary hover:bg-surface-primary hover:text-text-primary"
              }`}
            >
              {t("settings.roles.preview.rag")}
            </button>
          </div>

          <TextInput
            label={t("settings.roles.preview.testInput")}
            value={testInput}
            onChange={setTestInput}
          />

          <CodeBlock tone="terminal" className="whitespace-pre-wrap">
            {previewPrompt}
          </CodeBlock>
        </div>
      </Drawer>

      <Drawer
        open={activeField !== null}
        onClose={() => setActiveField(null)}
        width={560}
        closeLabel={t("settings.roles.fieldDrawer.close")}
        closeMaskLabel={t("settings.roles.fieldDrawer.closeMask")}
        header={
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <SquarePen className="h-4 w-4 text-icon-secondary" />
              {activeField ? t(`settings.roles.form.${activeField}`) : ""}
            </div>
            <div className="text-xs leading-5 text-text-secondary">
              {activeFieldDescription}
            </div>
            <div className="text-xs leading-5 text-text-secondary">
              {activeFieldNote}
            </div>
            {activeField ? (
              <ExpandableSection
                collapsedLabel={t("common.actions.more")}
                expandedLabel={t("common.actions.collapse")}
                contentClassName="space-y-2 pt-2"
              >
                <Alert variant="info">
                  <div className="whitespace-pre-wrap break-words text-xs leading-5">
                    {activeFieldSyntax}
                  </div>
                </Alert>
                <Alert variant="success">
                  <div className="whitespace-pre-wrap break-words text-xs leading-5">
                    {activeFieldGood}
                  </div>
                </Alert>
                <Alert variant="danger">
                  <div className="whitespace-pre-wrap break-words text-xs leading-5">
                    {activeFieldBad}
                  </div>
                </Alert>
              </ExpandableSection>
            ) : null}
          </div>
        }
        bodyClassName="flex min-h-0 flex-col overflow-hidden py-3"
        footer={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={resetFieldEditor}>
              {t("common.actions.reset")}
            </Button>
            <Button size="sm" onClick={handleSaveField}>
              {t("common.actions.save")}
            </Button>
          </div>
        }
      >
        {activeField ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <MarkdownEditor
              key={`${selectedRoleId}-${activeField}-${fieldEditorKey}`}
              initialValue={fieldEditorValue}
              onChange={setFieldEditorValue}
              placeholder={t(`settings.roles.form.${activeField}`)}
              className="min-h-0 flex-1 overflow-hidden"
            />
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
