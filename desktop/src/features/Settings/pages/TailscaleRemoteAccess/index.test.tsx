// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TailscaleRemoteAccessSettings from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("TailscaleRemoteAccessSettings", () => {
  it("renders remote access fields without executable actions", async () => {
    render(<TailscaleRemoteAccessSettings />);

    expect(
      screen.getByText("settings.tailscaleRemoteAccess.status.notConnected"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.tailscaleRemoteAccess.device.name"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.tailscaleRemoteAccess.device.tailnet"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("https://mira-desktop.example.ts.net"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings.tailscaleRemoteAccess.actions.check",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "settings.tailscaleRemoteAccess.actions.save",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByText(
        "settings.tailscaleRemoteAccess.guide.steps.install.title",
      ),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "settings.tailscaleRemoteAccess.actions.openGuide",
      }),
    );
    expect(
      screen.getByText("settings.tailscaleRemoteAccess.guide.drawerTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "settings.tailscaleRemoteAccess.guide.steps.install.title",
      ),
    ).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("settings.tailscaleRemoteAccess.device.name"),
      "studio-pc",
    );
    expect(
      screen.getByText("https://studio-pc.example.ts.net"),
    ).toBeInTheDocument();
  });
});
