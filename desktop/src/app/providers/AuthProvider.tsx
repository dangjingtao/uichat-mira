import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AUTH_REQUIRED_EVENT,
  AuthRequiredEventDetail,
  clearSessionFromStorage,
  readSessionFromStorage,
  writeSessionToStorage,
} from "@/shared/lib/sessionStorage";
import { SessionState } from "@/shared/types/auth";
import { getCurrentUser } from "@/shared/api/auth";

type AuthContextValue = {
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

/**
 * AuthProvider owns persisted login session state.
 *
 * It is intentionally the only provider that writes/clears auth session
 * storage. Other providers should react to `session?.token`, not duplicate
 * token persistence logic.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<SessionState | null>(() =>
    readSessionFromStorage(),
  );
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authErrorMessage, setAuthErrorMessage] = useState("");
  const sessionRevisionRef = useRef(0);

  const logout = useCallback((message = "") => {
    sessionRevisionRef.current += 1;
    clearSessionFromStorage();
    setSession(null);
    setAuthErrorMessage(message);
  }, []);

  const login = useCallback((nextSession: SessionState) => {
    sessionRevisionRef.current += 1;
    writeSessionToStorage(nextSession);
    setSession(nextSession);
    setAuthErrorMessage("");
  }, []);

  const consumeAuthError = useCallback(() => {
    setAuthErrorMessage("");
  }, []);

  useEffect(() => {
    const handleAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<AuthRequiredEventDetail>).detail;
      logout(detail?.message || "登录状态已过期，请重新登录。");
    };

    globalThis.addEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    return () => {
      globalThis.removeEventListener(AUTH_REQUIRED_EVENT, handleAuthRequired);
    };
  }, [logout]);

  useEffect(() => {
    let mounted = true;
    const currentToken = session?.token;
    const validationRevision = sessionRevisionRef.current;

    const validateCurrentSession = async () => {
      if (!currentToken) {
        if (mounted) {
          setIsCheckingSession(false);
        }
        return;
      }

      try {
        const { user } = await getCurrentUser();

        if (mounted && sessionRevisionRef.current === validationRevision) {
          login({
            token: currentToken,
            user,
          });
        }
      } catch {
        if (mounted && sessionRevisionRef.current === validationRevision) {
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
  }, [login, logout, session?.token]);

  const value = useMemo(
    () => ({
      session,
      isCheckingSession,
      authErrorMessage,
      login,
      logout,
      consumeAuthError,
    }),
    [
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
