import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getBuiltinAvatarPack16Options } from "@/shared/avatars";
import SettingsPageLayout from "../../components/SettingsPageLayout";
import RoleEditor from "./components/RoleEditor";
import RoleFieldDrawer from "./components/RoleFieldDrawer";
import RoleList from "./components/RoleList";
import RoleLlmProfileDrawer from "./components/RoleLlmProfileDrawer";
import RolePreviewDrawer from "./components/RolePreviewDrawer";
import { useRoles } from "./hooks/useRoles";
import { useRoleTranslation } from "./i18n/useRoleTranslation";
import "./i18n";

export default function RoleSettings() {
  const t = useRoleTranslation();
  const { t: globalT } = useTranslation();
  const avatarOptions = useMemo(() => getBuiltinAvatarPack16Options(), []);
  const avatarSrcMap = useMemo(
    () => new Map(avatarOptions.map((option) => [option.id, option.src])),
    [avatarOptions],
  );

  const {
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
    previewOpen,
    setPreviewOpen,
    previewMode,
    setPreviewMode,
    testInput,
    setTestInput,
    previewPrompt,
    previewChatReply,
    activeField,
    closeFieldDrawer,
    openFieldDrawer,
    fieldEditorValue,
    setFieldEditorValue,
    fieldEditorKey,
    resetFieldEditor,
    handleSaveField,
    handleNewRole,
    handleSave,
    handleDelete,
    resetDraft,
    isLlmProfileDrawerOpen,
    isSavingLlmProfile,
    openLlmProfileDrawer,
    closeLlmProfileDrawer,
    patchDraftLlmProfile,
    resetDraftLlmProfile,
    handleSaveLlmProfile,
  } = useRoles();

  const selectedRoleAvatarSrc =
    draftAvatarId && avatarSrcMap.has(draftAvatarId)
      ? avatarSrcMap.get(draftAvatarId) ?? null
      : selectedRole?.avatarId
        ? avatarSrcMap.get(selectedRole.avatarId) ?? null
        : null;

  return (
    <>
      <SettingsPageLayout
        miniTitle={t("page.miniTitle")}
        title={t("page.title")}
        description={t("page.description")}
        contentClassName="pt-6"
      >
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[280px_minmax(0,1fr)] gap-3">
          <RoleList
            roles={roles}
            isLoading={isLoading}
            selectedRoleId={selectedRoleId}
            avatarSrcMap={avatarSrcMap}
            onSelectRoleId={setSelectedRoleId}
            onNewRole={handleNewRole}
          />

          <RoleEditor
            selectedRole={selectedRole}
            draftAvatarId={draftAvatarId}
            draftName={draftName}
            draftSummary={draftSummary}
            draftTags={draftTags}
            draftValues={draftValues}
            draftLlmProfile={draftLlmProfile}
            avatarOptions={avatarOptions}
            isEdited={isEdited}
            isCoreContentEmpty={isCoreContentEmpty}
            formErrors={formErrors}
            onAvatarChange={(option) => setDraftAvatarId(option.id)}
            onAvatarClear={() => setDraftAvatarId(null)}
            onNameChange={setDraftName}
            onSummaryChange={setDraftSummary}
            onTagsChange={setDraftTags}
            onOpenFieldDrawer={openFieldDrawer}
            onOpenLlmProfileDrawer={openLlmProfileDrawer}
            onPreviewOpen={() => setPreviewOpen(true)}
            onSave={handleSave}
            onReset={resetDraft}
            onDelete={handleDelete}
          />
        </div>
      </SettingsPageLayout>

      <RolePreviewDrawer
        open={previewOpen}
        mode={previewMode}
        testInput={testInput}
        roleName={draftName.trim() || selectedRole?.name || "-"}
        roleAvatarSrc={selectedRoleAvatarSrc}
        previewChatReply={previewChatReply}
        assistantTypingLabel={globalT("chat.thread.assistantTyping")}
        previewPrompt={previewPrompt}
        onClose={() => setPreviewOpen(false)}
        onModeChange={setPreviewMode}
        onTestInputChange={setTestInput}
      />

      <RoleFieldDrawer
        activeField={activeField}
        selectedRoleId={selectedRoleId}
        fieldEditorValue={fieldEditorValue}
        fieldEditorKey={fieldEditorKey}
        onClose={closeFieldDrawer}
        onChange={setFieldEditorValue}
        onReset={resetFieldEditor}
        onSave={handleSaveField}
      />

      <RoleLlmProfileDrawer
        open={isLlmProfileDrawerOpen}
        profile={draftLlmProfile}
        saving={isSavingLlmProfile}
        onClose={closeLlmProfileDrawer}
        onChange={patchDraftLlmProfile}
        onReset={resetDraftLlmProfile}
        onSave={handleSaveLlmProfile}
      />
    </>
  );
}
