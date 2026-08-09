// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RoleSettings from "./index";

const actions = vi.hoisted(() => ({
  handleNewRole: vi.fn(),
  handleSave: vi.fn(),
  openFieldDrawer: vi.fn(),
  openLlmProfileDrawer: vi.fn(),
  setPreviewOpen: vi.fn(),
  setSelectedRoleId: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("./i18n/useRoleTranslation", () => ({
  useRoleTranslation: () => (key: string) => key,
}));
vi.mock("@/shared/avatars", () => ({
  getBuiltinAvatarPack16Options: () => [
    { id: "avatar-1", label: "A", src: "/avatar.png" },
  ],
}));
vi.mock("./hooks/useRoles", () => ({
  useRoles: () => ({
    roles: [{ id: "role-1", name: "Reviewer", avatarId: "avatar-1" }],
    isLoading: false,
    selectedRole: { id: "role-1", name: "Reviewer", avatarId: "avatar-1" },
    selectedRoleId: "role-1",
    setSelectedRoleId: actions.setSelectedRoleId,
    draftAvatarId: "avatar-1",
    draftName: "Reviewer",
    draftSummary: "Summary",
    draftValues: {},
    draftTags: [],
    draftLlmProfile: {},
    isEdited: true,
    isCoreContentEmpty: false,
    formErrors: {},
    setDraftAvatarId: vi.fn(),
    setDraftName: vi.fn(),
    setDraftSummary: vi.fn(),
    setDraftTags: vi.fn(),
    previewOpen: false,
    setPreviewOpen: actions.setPreviewOpen,
    previewMode: "prompt",
    setPreviewMode: vi.fn(),
    testInput: "",
    setTestInput: vi.fn(),
    previewPrompt: "Prompt",
    previewChatReply: "Reply",
    activeField: null,
    closeFieldDrawer: vi.fn(),
    openFieldDrawer: actions.openFieldDrawer,
    fieldEditorValue: "",
    setFieldEditorValue: vi.fn(),
    fieldEditorKey: "key",
    resetFieldEditor: vi.fn(),
    handleSaveField: vi.fn(),
    handleNewRole: actions.handleNewRole,
    handleSave: actions.handleSave,
    handleDelete: vi.fn(),
    resetDraft: vi.fn(),
    isLlmProfileDrawerOpen: false,
    isSavingLlmProfile: false,
    openLlmProfileDrawer: actions.openLlmProfileDrawer,
    closeLlmProfileDrawer: vi.fn(),
    patchDraftLlmProfile: vi.fn(),
    resetDraftLlmProfile: vi.fn(),
    handleSaveLlmProfile: vi.fn(),
  }),
}));
vi.mock("../../components/SettingsPageLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("./components/RoleList", () => ({
  default: ({ onNewRole, onSelectRoleId }: { onNewRole: () => void; onSelectRoleId: (id: string) => void }) => (
    <div>
      <button onClick={onNewRole}>new role</button>
      <button onClick={() => onSelectRoleId("role-2")}>select role</button>
    </div>
  ),
}));
vi.mock("./components/RoleEditor", () => ({
  default: ({ onSave, onOpenFieldDrawer, onOpenLlmProfileDrawer, onPreviewOpen }: {
    onSave: () => void;
    onOpenFieldDrawer: (field: string) => void;
    onOpenLlmProfileDrawer: () => void;
    onPreviewOpen: () => void;
  }) => (
    <div>
      <button onClick={onSave}>save role</button>
      <button onClick={() => onOpenFieldDrawer("systemPrompt")}>open field</button>
      <button onClick={onOpenLlmProfileDrawer}>open model</button>
      <button onClick={onPreviewOpen}>open preview</button>
    </div>
  ),
}));
vi.mock("./components/RolePreviewDrawer", () => ({ default: () => <div>preview drawer</div> }));
vi.mock("./components/RoleFieldDrawer", () => ({ default: () => <div>field drawer</div> }));
vi.mock("./components/RoleLlmProfileDrawer", () => ({ default: () => <div>model drawer</div> }));

describe("RoleSettings", () => {
  it("connects the list, editor, preview, field, and model surfaces", async () => {
    const user = userEvent.setup();
    render(<RoleSettings />);

    expect(screen.getByText("preview drawer")).toBeInTheDocument();
    expect(screen.getByText("field drawer")).toBeInTheDocument();
    expect(screen.getByText("model drawer")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "new role" }));
    await user.click(screen.getByRole("button", { name: "select role" }));
    await user.click(screen.getByRole("button", { name: "save role" }));
    await user.click(screen.getByRole("button", { name: "open field" }));
    await user.click(screen.getByRole("button", { name: "open model" }));
    await user.click(screen.getByRole("button", { name: "open preview" }));

    expect(actions.handleNewRole).toHaveBeenCalled();
    expect(actions.setSelectedRoleId).toHaveBeenCalledWith("role-2");
    expect(actions.handleSave).toHaveBeenCalled();
    expect(actions.openFieldDrawer).toHaveBeenCalledWith("systemPrompt");
    expect(actions.openLlmProfileDrawer).toHaveBeenCalled();
    expect(actions.setPreviewOpen).toHaveBeenCalledWith(true);
  });
});
