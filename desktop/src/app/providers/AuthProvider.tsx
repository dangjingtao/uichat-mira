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

export function AuthProvider({ children }: AuthProviderProps) {
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
        const { user } = await getCurrentUser();

        if (mounted) {
          login({
            token: currentToken,
            user,
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