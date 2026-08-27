// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ROLE_FIELDS } from "../constants";
import RoleEditor from "./RoleEditor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("../i18n/useRoleTranslation", () => ({
  useRoleTranslation: () => (key: string) => key,
}));
vi.mock("@/shared/ui/AvatarPicker", () => ({
  default: ({ onChange }: { onChange: (option: { id: string }) => void }) => (
    <button onClick={() => onChange({ id: "avatar-2" })}>pick avatar</button>
  ),
}));
vi.mock("@/shared/ui/TagInput", () => ({
  default: ({ onChange }: { onChange: (tags: string[]) => void }) => (
    <button onClick={() => onChange(["updated"])}>change tags</button>
  ),
}));
vi.mock("./RoleSectionTitle", () => ({
  default: ({ title }: { title: string }) => <h2>{title}</h2>,
}));
vi.mock("./RoleLlmProfileCard", () => ({
  default: ({ onClick }: { onClick: () => void }) => (
    <button onClick={onClick}>llm profile</button>
  ),
}));

const draftValues = Object.fromEntries(
  ROLE_FIELDS.map((field) => [field, field === "systemPrompt" ? "System truth" : ""]),
) as Record<(typeof ROLE_FIELDS)[number], string>;

function renderEditor(overrides: Record<string, unknown> = {}) {
  const props = {
    selectedRole: {
      id: "role-1",
      name: "Reviewer",
      status: "active",
    },
    draftAvatarId: "avatar-1",
    draftName: "Reviewer",
    draftSummary: "Reviews evidence",
    draftTags: ["review"],
    draftValues,
    draftLlmProfile: {},
    avatarOptions: [{ id: "avatar-1", label: "A", src: "/a.png" }],
    isEdited: true,
    isCoreContentEmpty: false,
    formErrors: {},
    onAvatarChange: vi.fn(),
    onAvatarClear: vi.fn(),
    onNameChange: vi.fn(),
    onSummaryChange: vi.fn(),
    onTagsChange: vi.fn(),
    onOpenFieldDrawer: vi.fn(),
    onOpenLlmProfileDrawer: vi.fn(),
    onPreviewOpen: vi.fn(),
    onSave: vi.fn(),
    onReset: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<RoleEditor {...(props as never)} />);
  return props;
}

describe("RoleEditor", () => {
  it("forwards core edits and top-level actions", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    fireEvent.change(screen.getByLabelText("form.name"), {
      target: { value: "New reviewer" },
    });
    await user.click(screen.getByRole("button", { name: "common.actions.save" }));
    await user.click(screen.getByRole("button", { name: "common.actions.reset" }));
    await user.click(screen.getByRole("button", { name: "actions.preview" }));
    await user.click(screen.getByRole("button", { name: "actions.delete" }));

    expect(props.onNameChange).toHaveBeenLastCalledWith("New reviewer");
    expect(props.onSave).toHaveBeenCalled();
    expect(props.onReset).toHaveBeenCalled();
    expect(props.onPreviewOpen).toHaveBeenCalled();
    expect(props.onDelete).toHaveBeenCalled();
  });

  it("opens field and model drawers and forwards avatar and tags", async () => {
    const user = userEvent.setup();
    const props = renderEditor();

    await user.click(screen.getByRole("button", { name: /form.description/ }));
    await user.click(screen.getByRole("button", { name: "llm profile" }));
    await user.click(screen.getByRole("button", { name: "pick avatar" }));
    await user.click(screen.getByRole("button", { name: "change tags" }));

    expect(props.onOpenFieldDrawer).toHaveBeenCalledWith("description");
    expect(props.onOpenLlmProfileDrawer).toHaveBeenCalled();
    expect(props.onAvatarChange).toHaveBeenCalledWith({ id: "avatar-2" });
    expect(props.onTagsChange).toHaveBeenCalledWith(["updated"]);
  });

  it("shows validation state and disables save for a clean draft", () => {
    renderEditor({
      isEdited: false,
      isCoreContentEmpty: true,
      formErrors: { name: "Name required" },
    });

    expect(screen.getByText("form.coreContentEmpty")).toBeInTheDocument();
    expect(screen.getByText("Name required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.actions.save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "common.actions.reset" })).toBeDisabled();
  });
});
