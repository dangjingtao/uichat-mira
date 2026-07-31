// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PersonalizationSettings from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("PersonalizationSettings", () => {
  it("renders the personalization fields and opens the memory summary", async () => {
    render(<PersonalizationSettings />);

    expect(
      screen.getByText("settings.personalization.tone.label"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.instructions.label"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.aboutYou.nickname"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.aboutYou.occupation"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.aboutYou.details"),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "settings.personalization.memory.manage",
      }),
    );

    expect(
      screen.getByText("settings.personalization.memory.drawerTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.memory.updateLabel"),
    ).toBeInTheDocument();
  });

  it("disables memory management when memory is turned off", async () => {
    render(<PersonalizationSettings />);

    await userEvent.click(
      screen.getByRole("switch", {
        name: "settings.personalization.memory.enable",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "settings.personalization.memory.manage",
      }),
    ).toBeDisabled();
  });
});
