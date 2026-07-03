// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AvatarPicker, { AvatarPickerOption } from "../AvatarPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const options: AvatarPickerOption[] = [
  {
    id: "a",
    label: "Alpha",
    src: "/a.png",
    description: "First option",
    tags: ["tag-a"],
  },
  {
    id: "b",
    label: "Beta",
    src: "/b.png",
    description: "Second option",
  },
  { id: "c", label: "Gamma", src: "/c.png", disabled: true },
];

function setup(props = {}) {
  return {
    user: userEvent.setup(),
    onChange: vi.fn(),
    onClear: vi.fn(),
    ...props,
  };
}

describe("AvatarPicker", () => {
  it("renders trigger placeholder when no value", () => {
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    expect(screen.getByText("ui.avatarPicker.placeholder")).toBeInTheDocument();
    expect(screen.getByText("ui.avatarPicker.triggerHint")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ui\.avatarPicker\.selectAction/i }),
    ).toBeInTheDocument();
  });

  it("renders selected option in trigger", () => {
    render(<AvatarPicker value="a" options={options} onChange={vi.fn()} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("First option")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /ui\.avatarPicker\.changeAction/i }),
    ).toBeInTheDocument();
  });

  it("shows label and hint", () => {
    render(
      <AvatarPicker
        options={options}
        onChange={vi.fn()}
        label="Pick avatar"
        hint="Choose wisely"
      />,
    );

    expect(screen.getByText("Pick avatar")).toBeInTheDocument();
    expect(screen.getByText("Choose wisely")).toBeInTheDocument();
  });

  it("disables trigger when disabled", () => {
    render(<AvatarPicker options={options} onChange={vi.fn()} disabled />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("opens modal and lists options", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("ui.avatarPicker.title")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("selects draft option and confirms", async () => {
    const { user, onChange } = setup();
    render(<AvatarPicker options={options} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Beta"));

    await user.click(screen.getByText("common.actions.confirm"));

    expect(onChange).toHaveBeenCalledWith(options[1]);
  });

  it("does not call onChange when confirming without selection", async () => {
    const { user, onChange } = setup();
    render(<AvatarPicker options={options} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("common.actions.confirm"));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("filters options by search", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    const searchInput = screen.getByPlaceholderText(
      "ui.avatarPicker.searchPlaceholder",
    );
    await user.type(searchInput, "alpha");

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
  });

  it("shows empty state when search has no matches", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    const searchInput = screen.getByPlaceholderText(
      "ui.avatarPicker.searchPlaceholder",
    );
    await user.type(searchInput, "zzz");

    expect(screen.getByText("ui.avatarPicker.empty")).toBeInTheDocument();
  });

  it("cannot select disabled option", async () => {
    const { user, onChange } = setup();
    render(<AvatarPicker options={options} onChange={onChange} />);

    await user.click(screen.getByRole("button"));

    const disabledButton = screen.getByText("Gamma").closest("button");
    expect(disabledButton).toBeDisabled();

    if (disabledButton) {
      await user.click(disabledButton);
    }

    await user.click(screen.getByText("common.actions.confirm"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("calls onClear when clear action is used", async () => {
    const { user, onChange, onClear } = setup();
    render(
      <AvatarPicker
        value="a"
        options={options}
        onChange={onChange}
        onClear={onClear}
        allowClear
      />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("ui.avatarPicker.clearAction"));

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("updates preview panel when selecting option", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Alpha"));

    const preview = screen.getByText("ui.avatarPicker.previewLabel").parentElement;
    expect(preview).toHaveTextContent("Alpha");
    expect(preview).toHaveTextContent("First option");
    expect(preview).toHaveTextContent("tag-a");
  });

  it("syncs draft value when value prop changes while modal is closed", async () => {
    const { user, onChange } = setup();
    const { rerender } = render(
      <AvatarPicker value="a" options={options} onChange={onChange} />,
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Beta"));

    rerender(<AvatarPicker value="b" options={options} onChange={onChange} />);

    await user.click(screen.getByText("common.actions.confirm"));
    expect(onChange).toHaveBeenCalledWith(options[1]);
  });

  it("closes modal on cancel", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    expect(screen.getByText("ui.avatarPicker.title")).toBeInTheDocument();

    await user.click(screen.getByText("common.actions.cancel"));
    expect(screen.queryByText("ui.avatarPicker.title")).not.toBeInTheDocument();
  });

  it("resets search when modal reopens", async () => {
    const { user } = setup();
    render(<AvatarPicker options={options} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    const searchInput = screen.getByPlaceholderText(
      "ui.avatarPicker.searchPlaceholder",
    );
    await user.type(searchInput, "alpha");
    expect(screen.queryByText("Beta")).not.toBeInTheDocument();

    await user.click(screen.getByText("common.actions.cancel"));
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Beta")).toBeInTheDocument();
  });
});
