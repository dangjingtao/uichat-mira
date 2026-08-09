// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "./LoginPage";

const navigate = vi.hoisted(() => vi.fn());
const loginSession = vi.hoisted(() => vi.fn());
const consumeAuthError = vi.hoisted(() => vi.fn());
const apiLogin = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({ authErrorMessage: "" }));
const stableT = (key: string) => key.startsWith("auth.login.quotes.") ? `${key} / Author` : key;

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: stableT }) }));
vi.mock("react-typewriter-plus", () => ({ useTypewriter: (value: string) => value }));
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams("returnTo=%2Fsettings%2Fgeneral")],
}));
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ authErrorMessage: authState.authErrorMessage, consumeAuthError, login: loginSession }),
}));
vi.mock("@/shared/api", () => ({ login: apiLogin }));
vi.mock("@/shared/api/system", () => ({ getAppMeta: vi.fn() }));
vi.mock("@/shared/platform/desktopRuntime", () => ({ isDesktopShell: () => false }));
vi.mock("@/shared/lib/request", () => ({ ApiError: class ApiError extends Error {} }));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.authErrorMessage = "";
    sessionStorage.clear();
  });

  it("keeps submit disabled until both credentials are present", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    const submit = screen.getByRole("button", { name: /auth.login.signIn/ });
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("auth.login.username"), "alice");
    expect(submit).toBeDisabled();
    await user.type(screen.getByLabelText("auth.login.password"), "secret");
    expect(submit).toBeEnabled();
  });

  it("logs in and honors the encoded return destination", async () => {
    apiLogin.mockResolvedValue({ token: "token-1", user: { id: 1, username: "alice", role: "admin" } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText("auth.login.username"), "alice");
    await user.type(screen.getByLabelText("auth.login.password"), "secret");
    await user.click(screen.getByRole("button", { name: /auth.login.signIn/ }));
    await waitFor(() => expect(apiLogin).toHaveBeenCalledWith({ username: "alice", password: "secret" }));
    expect(loginSession).toHaveBeenCalledWith({ token: "token-1", user: { id: 1, username: "alice", role: "admin" } });
    expect(navigate).toHaveBeenCalledWith("/settings/general", { replace: true });
  });

  it("surfaces and consumes an authentication-expired message", async () => {
    authState.authErrorMessage = "Session expired";
    render(<LoginPage />);
    expect(await screen.findByText("Session expired")).toBeInTheDocument();
    expect(consumeAuthError).toHaveBeenCalled();
  });
});
