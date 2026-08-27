// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import HomePage from "./HomePage";

const navigate = vi.fn();
const logout = vi.fn();
let session: { user: { username: string } } | null = { user: { username: "Mira" } };

vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { username?: string }) =>
      values?.username ? `${key}:${values.username}` : key,
  }),
}));
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ session, logout }),
}));
vi.mock("../../system/hooks/useRuntimeHealth", () => ({
  useRuntimeHealth: () => ({
    runtime: { hostKind: "electron", backendUrl: "http://127.0.0.1:3000" },
    backendState: { status: "running", detail: "backend detail" },
    databaseState: { status: "stopped", detail: "database offline" },
  }),
}));

describe("HomePage", () => {
  beforeEach(() => {
    session = { user: { username: "Mira" } };
    navigate.mockReset();
    logout.mockReset();
  });

  it("renders the authenticated runtime overview", () => {
    render(<HomePage />);
    expect(screen.getByText("dashboard.home.welcomeBack:Mira")).toBeInTheDocument();
    expect(screen.getByText("http://127.0.0.1:3000")).toBeInTheDocument();
    expect(screen.getByText("database offline")).toBeInTheDocument();
    expect(screen.getByText(/Electron/)).toBeInTheDocument();
  });

  it("navigates to chat/settings and logs out", async () => {
    const user = userEvent.setup();
    render(<HomePage />);
    await user.click(screen.getByRole("button", { name: "dashboard.home.enterChat" }));
    await user.click(screen.getByRole("button", { name: "dashboard.home.checkSettings" }));
    await user.click(screen.getByRole("button", { name: "dashboard.home.logout" }));
    expect(navigate).toHaveBeenNthCalledWith(1, "/chat");
    expect(navigate).toHaveBeenNthCalledWith(2, "/settings/general");
    expect(logout).toHaveBeenCalledOnce();
  });

  it("renders nothing without a session", () => {
    session = null;
    const { container } = render(<HomePage />);
    expect(container).toBeEmptyDOMElement();
  });
});
