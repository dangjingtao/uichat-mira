// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/shared/api/auth";
import {
  notifyAuthRequired,
  readSessionFromStorage,
  writeSessionToStorage,
} from "@/shared/lib/sessionStorage";
import type { SessionState } from "@/shared/types/auth";
import { AuthProvider, useAuth } from "../AuthProvider";

vi.mock("@/shared/api/auth", () => ({
  getCurrentUser: vi.fn(),
}));

const session: SessionState = {
  token: "expired-token",
  user: { id: 1, username: "alice", role: "admin" },
};

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(getCurrentUser).mockReset();
    vi.mocked(getCurrentUser).mockResolvedValue({ user: session.user });
  });

  it("owns the complete logout transition after an auth-required event", async () => {
    writeSessionToStorage(session);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isCheckingSession).toBe(false));
    expect(result.current.session).toEqual(session);

    act(() => notifyAuthRequired("登录状态已过期，请重新登录。"));

    expect(result.current.session).toBeNull();
    expect(result.current.authErrorMessage).toBe("登录状态已过期，请重新登录。");
    expect(readSessionFromStorage()).toBeNull();
  });

  it("handles duplicate auth-required events without restoring the session", async () => {
    writeSessionToStorage(session);
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isCheckingSession).toBe(false));

    act(() => {
      notifyAuthRequired("unauthorized");
      notifyAuthRequired("unauthorized");
    });

    expect(result.current.session).toBeNull();
    expect(result.current.authErrorMessage).toBe("unauthorized");
    expect(readSessionFromStorage()).toBeNull();
  });

  it("ignores an in-flight session validation after auth becomes invalid", async () => {
    let resolveValidation!: (value: { user: SessionState["user"] }) => void;
    vi.mocked(getCurrentUser).mockReturnValue(
      new Promise((resolve) => {
        resolveValidation = resolve;
      }),
    );
    writeSessionToStorage(session);
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => notifyAuthRequired("token expired"));
    await act(async () => {
      resolveValidation({ user: session.user });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isCheckingSession).toBe(false));
    expect(result.current.session).toBeNull();
    expect(result.current.authErrorMessage).toBe("token expired");
    expect(readSessionFromStorage()).toBeNull();
  });
});
