// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExtensionAuthorizePage from "./ExtensionAuthorizePage";

const navigate = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  isCheckingSession: false,
  session: null as null | { token: string },
}));
const searchState = vi.hoisted(() => ({
  value: "client_id=clipper&redirect_uri=https%3A%2F%2Fclipper.local%2Fcallback&code_challenge=challenge&state=state-1",
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams(searchState.value)],
}));
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => authState,
}));
vi.mock("@/shared/lib/request", () => ({ post }));

describe("ExtensionAuthorizePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.isCheckingSession = false;
    authState.session = null;
    searchState.value =
      "client_id=clipper&redirect_uri=https%3A%2F%2Fclipper.local%2Fcallback&code_challenge=challenge&state=state-1";
  });

  it("shows session validation while authentication is unresolved", () => {
    authState.isCheckingSession = true;
    render(<ExtensionAuthorizePage />);
    expect(screen.getByText(/\.\./)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("sends anonymous users to login with the full authorize request", async () => {
    const user = userEvent.setup();
    render(<ExtensionAuthorizePage />);
    await user.click(screen.getByRole("button"));

    const expectedReturnTo = `/oauth/authorize?${searchState.value}`;
    expect(navigate).toHaveBeenCalledWith(
      `/login?returnTo=${encodeURIComponent(expectedReturnTo)}`,
    );
  });

  it("rejects incomplete authenticated requests before approval", async () => {
    authState.session = { token: "token" };
    searchState.value = "client_id=clipper";
    render(<ExtensionAuthorizePage />);

    await waitFor(() => expect(screen.queryByRole("button")).not.toBeInTheDocument());
    expect(post).not.toHaveBeenCalled();
  });

  it("submits complete params and renders an approval error", async () => {
    authState.session = { token: "token" };
    post.mockRejectedValue(new Error("Extension approval failed"));
    const user = userEvent.setup();
    render(<ExtensionAuthorizePage />);

    await user.click(screen.getByRole("button"));

    expect(post).toHaveBeenCalledWith("/oauth/authorize/approve", {
      client_id: "clipper",
      redirect_uri: "https://clipper.local/callback",
      code_challenge: "challenge",
      state: "state-1",
    });
    expect(await screen.findByText("Extension approval failed")).toBeInTheDocument();
  });
});
