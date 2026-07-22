import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import type { ChatRuntimeState } from "../core";
import type { ChatRuntime } from "../core/runtime";

// React bindings are intentionally separate from uchat core so the runtime can
// stay framework-agnostic and still be convenient for React consumers.
const UChatRuntimeContext = createContext<ChatRuntime | null>(null);

export type UChatApplicationStateProviderProps = {
  sessionKey: string | number;
  createRuntime: () => ChatRuntime;
  disposeRuntime?: (runtime: ChatRuntime) => void;
  children: ReactNode;
};

function UChatApplicationStateScope({
  createRuntime,
  disposeRuntime,
  children,
}: Omit<UChatApplicationStateProviderProps, "sessionKey">) {
  const runtimeRef = useRef<ChatRuntime | null>(null);
  const disposeRuntimeRef = useRef(disposeRuntime);
  disposeRuntimeRef.current = disposeRuntime;

  if (!runtimeRef.current) {
    runtimeRef.current = createRuntime();
  }

  const runtime = runtimeRef.current;

  useEffect(
    () => () => {
      disposeRuntimeRef.current?.(runtime);
    },
    [runtime],
  );

  return (
    <UChatRuntimeProvider runtime={runtime}>{children}</UChatRuntimeProvider>
  );
}

// UChatApplicationStateProvider owns one runtime for one application session.
// App integrations inject adapters through createRuntime without coupling UChat
// to authentication, routing, transport, or product-specific state.
export function UChatApplicationStateProvider({
  sessionKey,
  createRuntime,
  disposeRuntime,
  children,
}: UChatApplicationStateProviderProps) {
  const scopeKey = `${typeof sessionKey}:${String(sessionKey)}`;

  return (
    <UChatApplicationStateScope
      key={scopeKey}
      createRuntime={createRuntime}
      disposeRuntime={disposeRuntime}
    >
      {children}
    </UChatApplicationStateScope>
  );
}

// UChatRuntimeProvider exposes a ChatRuntime instance to React consumers.
export function UChatRuntimeProvider({
  runtime,
  children,
}: {
  runtime: ChatRuntime;
  children: ReactNode;
}) {
  return (
    <UChatRuntimeContext.Provider value={runtime}>
      {children}
    </UChatRuntimeContext.Provider>
  );
}

// useUChatRuntime returns the current React-scoped runtime instance.
export function useUChatRuntime() {
  const runtime = useContext(UChatRuntimeContext);
  if (!runtime) {
    throw new Error("useUChatRuntime must be used within UChatRuntimeProvider");
  }

  return runtime;
}

// useUChatSelector bridges the vanilla Zustand store into React selectors.
export function useUChatSelector<T>(
  selector: (state: ChatRuntimeState) => T,
) {
  const runtime = useUChatRuntime();
  return useStore(runtime.store, selector);
}
