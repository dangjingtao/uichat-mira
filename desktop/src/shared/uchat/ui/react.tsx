import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import type { ChatRuntimeState } from "../core";
import type { ChatRuntime } from "../core/runtime";

// React bindings are intentionally separate from uchat core so the runtime can
// stay framework-agnostic and still be convenient for React consumers.
const UChatRuntimeContext = createContext<ChatRuntime | null>(null);

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
