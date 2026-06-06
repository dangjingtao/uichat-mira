import axios, { AxiosInstance } from "axios";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  clearSessionFromStorage,
  readSessionFromStorage,
  writeSessionToStorage,
} from "@/shared/lib/sessionStorage";
import { SessionState, SessionUser } from "@/shared/types/auth";

type AuthContextValue = {
  apiClient: AxiosInstance;
  session: SessionState | null;
  isCheckingSession: boolean;
  authErrorMessage: string;
  login: (session: SessionState) => void;
  logout: (message?: string) => void;
  consumeAuthError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const backendUrl =
    globalThis.window?.desktopApi?.backendUrl ?? "http://127.0.0.1:8787";

  const apiClient = useMemo(
    () =>
      axios.create({
        baseURL: backendUrl,
        timeout: 10000,
      }),
    [backendUrl],
  );

  const [session, setSession] = useState<SessionState | null>(() =>
    readSessionFromStorage(),
  );
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState("");

  const logout = useCallback((message = "") => {
    clearSessionFromStorage();
    setSession(null);
    setAuthErrorMessage(message);
  }, []);

  const login = useCallback((nextSession: SessionState) => {
    writeSessionToStorage(nextSession);
    setSession(nextSession);
    setAuthErrorMessage("");
  }, []);

  const consumeAuthError = useCallback(() => {
    setAuthErrorMessage("");
  }, []);

  useEffect(() => {
    if (session?.token) {
      apiClient.defaults.headers.common.Authorization = `Bearer ${session.token}`;
      return;
    }

    delete apiClient.defaults.headers.common.Authorization;
  }, [apiClient, session?.token]);

  useEffect(() => {
    let mounted = true;
    const currentToken = session?.token;

    const validateCurrentSession = async () => {
      if (!currentToken) {
        if (mounted) {
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const response = await apiClient.get("/api/me", {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        const payload = response.data as { ok: boolean; user: SessionUser };

        if (mounted && payload.ok) {
          login({
            token: currentToken,
            user: payload.user,
          });
        }
      } catch {
        if (mounted) {
          logout("登录状态已过期，请重新登录。");
        }
      } finally {
        if (mounted) {
          setIsCheckingSession(false);
        }
      }
    };

    void validateCurrentSession();

    return () => {
      mounted = false;
    };
  }, [apiClient, login, logout, session?.token]);

  useEffect(() => {
    const responseInterceptor = apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) {
          logout("请重新登录。");
        }

        return Promise.reject(error);
      },
    );

    return () => {
      apiClient.interceptors.response.eject(responseInterceptor);
    };
  }, [apiClient, logout]);

  const value = useMemo(
    () => ({
      apiClient,
      session,
      isCheckingSession,
      authErrorMessage,
      login,
      logout,
      consumeAuthError,
    }),
    [
      apiClient,
      session,
      isCheckingSession,
      authErrorMessage,
      login,
      logout,
      consumeAuthError,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
