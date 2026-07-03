import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createRole as createRoleRequest,
  deleteRole as deleteRoleRequest,
  listRoles,
  updateRole as updateRoleRequest,
} from "@/shared/api/roles";
import { message } from "@/shared/ui/Message";
import { Modal } from "@/shared/ui/Modal";
import type {
  RolePreviewMode,
  RoleField,
  RoleLlmProfile,
  RoleRecord,
} from "../types";
import { createBlankRole } from "../constants";
import { useRoleTranslation } from "../i18n/useRoleTranslation";
import {
  buildRolePreviewChatReply,
  normalizeLlmProfile,
  patchLlmProfileNumber,
  validateRoleForm,
  type RoleFormErrors,
} from "../utils";

export function useRoles() {
  const t = useRoleTranslation();
  const skipSelectedRoleHydrationRef = useRef(false);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<RolePreviewMode>("chat");
  const [testInput, setTestInput] = useState(t("defaults.previewInput"));

  const [draftWorldview, setDraftWorldview] = useState("");
  const [draftPersona, setDraftPersona] = useState("");
  const [draftScenario, setDraftScenario] = useState("");
  const [draftExampleDialogues, setDraftExampleDialogues] = useState("");
  const [draftStyle, setDraftStyle] = useState("");
  const [draftConstraints, setDraftConstraints] = useState("");
  const [draftAvatarId, setDraftAvatarId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [draftLlmProfile, setDraftLlmProfile] = useState<RoleLlmProfile>({});
  const [formErrors, setFormErrors] = useState<RoleFormErrors>({});
  const [activeField, setActiveField] = useState<RoleField | null>(null);
  const [fieldEditorValue, setFieldEditorValue] = useState("");
  const [fieldEditorKey, setFieldEditorKey] = useState(0);
  const [isLlmProfileDrawerOpen, setIsLlmProfileDrawerOpen] = useState(false);
  const [isSavingLlmProfile, setIsSavingLlmProfile] = useState(false);

  const selectedRole = useMemo(
    () => roles.find((item) => item.id === selectedRoleId) ?? roles[0] ?? null,
    [roles, selectedRoleId],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        const remoteRoles = await listRoles();
        if (cancelled) {
          return;
        }

        setRoles(remoteRoles);
        setSelectedRoleId((current) => {
          if (current && remoteRoles.some((role) => role.id === current)) {
            return current;
          }

          return remoteRoles[0]?.id ?? "";
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRoles([]);
        setSelectedRoleId("");
        message.error(
          error instanceof Error ? error.message : t("messages.loadFailed"),
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!selectedRole) {
      return;
    }

    if (skipSelectedRoleHydrationRef.current) {
      skipSelectedRoleHydrationRef.current = false;
      return;
    }

    setDraftName(selectedRole.name);
    setDraftSummary(selectedRole.summary);
    setDraftDescription(selectedRole.prompt.description);
    setDraftTags(selectedRole.tags);
    setDraftLlmProfile(normalizeLlmProfile(selectedRole.llmProfile));
    setDraftAvatarId(selectedRole.avatarId);
    setDraftWorldview(selectedRole.prompt.worldview);
    setDraftPersona(selectedRole.prompt.persona);
    setDraftScenario(selectedRole.prompt.scenario);
    setDraftExampleDialogues(selectedRole.prompt.exampleDialogues);
    setDraftStyle(selectedRole.prompt.style);
    setDraftConstraints(selectedRole.prompt.constraints);
    setFormErrors({});
    setActiveField(null);
  }, [selectedRole]);

  const draftValues: Record<RoleField, string> = useMemo(
    () => ({
      description: draftDescription,
      worldview: draftWorldview,
      persona: draftPersona,
      scenario: draftScenario,
      exampleDialogues: draftExampleDialogues,
      style: draftStyle,
      constraints: draftConstraints,
    }),
    [
      draftDescription,
      draftWorldview,
      draftPersona,
      draftScenario,
      draftExampleDialogues,
      draftStyle,
      draftConstraints,
    ],
  );

  const draftSetters: Record<RoleField, (value: string) => void> = useMemo(
    () => ({
      description: setDraftDescription,
      worldview: setDraftWorldview,
      persona: setDraftPersona,
      scenario: setDraftScenario,
      exampleDialogues: setDraftExampleDialogues,
      style: setDraftStyle,
      constraints: setDraftConstraints,
    }),
    [],
  );

  const isEdited = useMemo(
    () =>
      selectedRole?.avatarId !== draftAvatarId ||
      selectedRole?.name !== draftName ||
      selectedRole?.summary !== draftSummary ||
      selectedRole?.prompt.description !== draftDescription ||
      JSON.stringify(selectedRole?.tags ?? []) !== JSON.stringify(draftTags) ||
      selectedRole?.prompt.worldview !== draftWorldview ||
      selectedRole?.prompt.persona !== draftPersona ||
      selectedRole?.prompt.scenario !== draftScenario ||
      selectedRole?.prompt.exampleDialogues !== draftExampleDialogues ||
      selectedRole?.prompt.style !== draftStyle ||
      selectedRole?.prompt.constraints !== draftConstraints ||
      JSON.stringify(normalizeLlmProfile(selectedRole?.llmProfile)) !==
        JSON.stringify(normalizeLlmProfile(draftLlmProfile)),
    [
      selectedRole,
      draftAvatarId,
      draftName,
      draftSummary,
      draftDescription,
      draftTags,
      draftWorldview,
      draftPersona,
      draftScenario,
      draftExampleDialogues,
      draftStyle,
      draftConstraints,
      draftLlmProfile,
    ],
  );

  const isCoreContentEmpty = useMemo(
    () =>
      !draftDescription.trim() && !draftPersona.trim() && !draftScenario.trim(),
    [draftDescription, draftPersona, draftScenario],
  );

  const openFieldDrawer = useCallback(
    (field: RoleField) => {
      setActiveField(field);
      setFieldEditorValue(draftValues[field]);
      setFieldEditorKey((current) => current + 1);
    },
    [draftValues],
  );

  const resetFieldEditor = useCallback(() => {
    if (!activeField) {
      return;
    }

    setFieldEditorValue(draftValues[activeField]);
    setFieldEditorKey((current) => current + 1);
  }, [activeField, draftValues]);

  const handleSaveField = useCallback(() => {
    if (!activeField) {
      return;
    }

    draftSetters[activeField](fieldEditorValue.trim());
    setActiveField(null);
  }, [activeField, draftSetters, fieldEditorValue]);

  const handleNewRole = useCallback(() => {
    const run = async () => {
      const nextRole = createBlankRole(t, `role-${crypto.randomUUID()}`);
      const created = await createRoleRequest(nextRole);
      setRoles((current) => [created, ...current]);
      setSelectedRoleId(created.id);
      message.info(t("messages.created"));
    };

    void run().catch((error) => {
      message.error(
        error instanceof Error ? error.message : t("messages.createFailed"),
      );
    });
  }, [t]);

  const resetDraft = useCallback(() => {
    if (!selectedRole) {
      return;
    }

    setDraftName(selectedRole.name);
    setDraftSummary(selectedRole.summary);
    setDraftDescription(selectedRole.prompt.description);
    setDraftTags(selectedRole.tags);
    setDraftLlmProfile(normalizeLlmProfile(selectedRole.llmProfile));
    setDraftAvatarId(selectedRole.avatarId);
    setDraftWorldview(selectedRole.prompt.worldview);
    setDraftPersona(selectedRole.prompt.persona);
    setDraftScenario(selectedRole.prompt.scenario);
    setDraftExampleDialogues(selectedRole.prompt.exampleDialogues);
    setDraftStyle(selectedRole.prompt.style);
    setDraftConstraints(selectedRole.prompt.constraints);
    setFormErrors({});
    setActiveField(null);
    setIsLlmProfileDrawerOpen(false);
    message.info(t("messages.reset"));
  }, [selectedRole, t]);

  const handleSave = useCallback(() => {
    if (!selectedRole) {
      return;
    }

    const errors = validateRoleForm(t, {
      name: draftName,
      summary: draftSummary,
      prompt: {
        description: draftDescription,
        worldview: draftWorldview,
        persona: draftPersona,
        scenario: draftScenario,
        exampleDialogues: draftExampleDialogues,
        style: draftStyle,
        constraints: draftConstraints,
      },
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      message.error(t("messages.validationFailed"));
      return;
    }

    const run = async () => {
      const saved = await updateRoleRequest(selectedRole.id, {
        name: draftName.trim() || selectedRole.name,
        summary: draftSummary.trim(),
        tags: draftTags.slice(0, 3).map((tag) => tag.trim()),
        avatarId: draftAvatarId,
        status: "active",
        llmProfile: normalizeLlmProfile(draftLlmProfile),
        prompt: {
          description: draftDescription.trim(),
          worldview: draftWorldview.trim(),
          persona: draftPersona.trim(),
          scenario: draftScenario.trim(),
          exampleDialogues: draftExampleDialogues.trim(),
          style: draftStyle.trim(),
          constraints: draftConstraints.trim(),
        },
      });

      setRoles((current) =>
        current.map((role) => (role.id === saved.id ? saved : role)),
      );
      setFormErrors({});
      message.success(t("messages.saved"));
    };

    void run().catch((error) => {
      message.error(
        error instanceof Error ? error.message : t("messages.saveFailed"),
      );
    });
  }, [
    selectedRole,
    draftName,
    draftSummary,
    draftDescription,
    draftTags,
    draftAvatarId,
    draftWorldview,
    draftPersona,
    draftScenario,
    draftExampleDialogues,
    draftStyle,
    draftConstraints,
    draftLlmProfile,
    t,
  ]);

  const handleSaveLlmProfile = useCallback(() => {
    if (!selectedRole || isSavingLlmProfile) {
      return;
    }

    const nextLlmProfile = normalizeLlmProfile(draftLlmProfile);

    const run = async () => {
      setIsSavingLlmProfile(true);
      const saved = await updateRoleRequest(selectedRole.id, {
        llmProfile: nextLlmProfile,
      });

      skipSelectedRoleHydrationRef.current = true;
      setRoles((current) =>
        current.map((role) => (role.id === saved.id ? saved : role)),
      );
      setDraftLlmProfile(normalizeLlmProfile(saved.llmProfile));
      setIsLlmProfileDrawerOpen(false);
      message.success(t("llmProfile.messages.saved"));
    };

    void run()
      .catch((error) => {
        message.error(
          error instanceof Error
            ? error.message
            : t("llmProfile.messages.saveFailed"),
        );
      })
      .finally(() => {
        setIsSavingLlmProfile(false);
      });
  }, [draftLlmProfile, isSavingLlmProfile, selectedRole, t]);

  const handleDelete = useCallback(() => {
    if (!selectedRole) {
      return;
    }

    Modal.confirm({
      title: t("deleteModal.title"),
      description: t("deleteModal.description", {
        name: selectedRole.name,
      }),
      tone: "danger",
      confirmText: t("deleteModal.confirm"),
      cancelText: t("common.actions.cancel"),
      onConfirm: async () => {
        await deleteRoleRequest(selectedRole.id);
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
        message.success(t("messages.deleted", { name: selectedRole.name }));
      },
    });
  }, [selectedRole, selectedRoleId, t]);

  const previewPrompt = useMemo(() => {
    const knowledgeBlock =
      previewMode === "rag"
        ? t("preview.knowledgeInjected")
        : t("preview.knowledgeSkipped");

    return `${t("preview.blockTitle")}

[${t("preview.layers.system")}]
${t("preview.systemPrompt")}

[${t("preview.layers.role")}]
${t("preview.roleName")}: ${draftName.trim() || selectedRole?.name || "-"}
${t("preview.roleSummary")}: ${draftSummary.trim() || selectedRole?.summary || "-"}
${t("preview.roleDescription")}: ${draftDescription.trim() || selectedRole?.prompt.description || "-"}
${t("preview.roleWorldview")}: ${draftWorldview}
${t("preview.rolePersona")}: ${draftPersona}
${t("preview.roleScenario")}: ${draftScenario}
${t("preview.roleExamples")}: ${draftExampleDialogues}
${t("preview.roleStyle")}: ${draftStyle}
${t("preview.roleConstraints")}: ${draftConstraints}

[${t("preview.layers.knowledge")}]
${knowledgeBlock}

[${t("preview.layers.history")}]
${t("preview.historyNotice")}
${t("preview.input")}: ${testInput}`;
  }, [
    draftConstraints,
    draftDescription,
    draftExampleDialogues,
    draftName,
    draftPersona,
    draftScenario,
    draftStyle,
    draftSummary,
    draftWorldview,
    previewMode,
    selectedRole,
    t,
    testInput,
  ]);

  const previewChatReply = useMemo(
    () =>
      buildRolePreviewChatReply(t, {
        roleSummary: draftSummary.trim() || selectedRole?.summary || "",
        persona: draftPersona,
        scenario: draftScenario,
        style: draftStyle,
        constraints: draftConstraints,
        testInput,
      }),
    [
      draftConstraints,
      draftPersona,
      draftScenario,
      draftStyle,
      draftSummary,
      selectedRole,
      t,
      testInput,
    ],
  );

  return {
    roles,
    isLoading,
    selectedRole,
    selectedRoleId,
    setSelectedRoleId,
    draftAvatarId,
    draftName,
    draftSummary,
    draftValues,
    draftTags,
    draftLlmProfile,
    isEdited,
    isCoreContentEmpty,
    formErrors,
    setDraftAvatarId,
    setDraftName,
    setDraftSummary,
    setDraftTags,
    setDraftLlmProfile,
    handleNewRole,
    handleSave,
    handleDelete,
    resetDraft,
    previewOpen,
    setPreviewOpen,
    previewMode,
    setPreviewMode,
    testInput,
    setTestInput,
    previewPrompt,
    previewChatReply,
    activeField,
    setActiveField,
    openFieldDrawer,
    closeFieldDrawer: () => setActiveField(null),
    fieldEditorValue,
    setFieldEditorValue,
    fieldEditorKey,
    resetFieldEditor,
    handleSaveField,
    isLlmProfileDrawerOpen,
    isSavingLlmProfile,
    openLlmProfileDrawer: () => setIsLlmProfileDrawerOpen(true),
    closeLlmProfileDrawer: () => setIsLlmProfileDrawerOpen(false),
    patchDraftLlmProfile: (key: keyof RoleLlmProfile, rawValue: string) =>
      setDraftLlmProfile((current) =>
        patchLlmProfileNumber(current, key, rawValue),
      ),
    resetDraftLlmProfile: () =>
      setDraftLlmProfile(normalizeLlmProfile(selectedRole?.llmProfile)),
    handleSaveLlmProfile,
  };
}
