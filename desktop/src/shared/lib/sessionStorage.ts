import { SessionState } from "../types/auth";

const SESSION_STORAGE_KEY = "rag-demo-auth-session";

export const AUTH_REQUIRED_EVENT = "mira:auth-required";

export type AuthRequiredEventDetail = {
  message: string;
};

/**
 * 从 localStorage 读取会话
 */
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

/**
 * 写入会话到 localStorage
 */
export const writeSessionToStorage = (session: SessionState) => {
  globalThis.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
};

/**
 * 清除 localStorage 中的会话
 */
export const clearSessionFromStorage = () => {
  globalThis.localStorage.removeItem(SESSION_STORAGE_KEY);
};

/**
 * 通知认证状态所有者处理已失效的会话。
 */
export const notifyAuthRequired = (message: string) => {
  globalThis.dispatchEvent(
    new CustomEvent<AuthRequiredEventDetail>(AUTH_REQUIRED_EVENT, {
      detail: { message },
    }),
  );
};

/**
 * 获取当前会话（从 localStorage 读取）
 */
export const getSession = (): SessionState | null => {
  return readSessionFromStorage();
};
