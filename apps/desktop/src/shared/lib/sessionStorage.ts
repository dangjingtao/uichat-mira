import { SessionState } from "../types/auth";

const SESSION_STORAGE_KEY = "rag-demo-auth-session";

export const readSessionFromStorage = (): SessionState | null => {
  const serialized = globalThis.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(serialized) as SessionState;

    if (!parsed.token || !parsed.user?.username || !parsed.user?.role) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

export const writeSessionToStorage = (session: SessionState) => {
  globalThis.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearSessionFromStorage = () => {
  globalThis.localStorage.removeItem(SESSION_STORAGE_KEY);
};
