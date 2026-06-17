import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Thread, type SuggestionConfig } from "@assistant-ui/react-ui";
import type { AssistantRuntime } from "@assistant-ui/react";
import {
  AssistantRuntimeImpl,
  LocalRuntimeCore,
} from "@assistant-ui/core/internal";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { localChatModel } from "../../../app/layouts/lib/localChatModel";

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

function ChatPage() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { backendState } = useRuntimeHealth();

  const runtime = useMemo<AssistantRuntime>(() => {
    const core = new LocalRuntimeCore(
      {
        maxSteps: 2,
        adapters: {
          chatModel: localChatModel,
        },
      },
      undefined,
    );

    return new AssistantRuntimeImpl(core);
  }, []);

  const backendStatusLabel = useMemo(
    () =>
      backendState.status === "running"
        ? t("chat.page.statusRunning")
        : backendState.status === "stopped"
          ? t("chat.page.statusStopped")
          : t("chat.page.statusUnknown"),
    [backendState.status, t],
  );

  const defaultSuggestions: SuggestionConfig[] = useMemo(
    () => [
      { prompt: t("chat.page.suggestion1") },
      { prompt: t("chat.page.suggestion2") },
      { prompt: t("chat.page.suggestion3") },
    ],
    [t],
  );

  const backendStatusColorClass = useMemo(
    () => statusColorMap[backendState.status],
    [backendState.status],
  );

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* <ThreadListSidebar /> */}
      <div className="flex-1 min-w-0">
        <Thread
          // runtime={runtime}
          welcome={{
            message: t("chat.page.welcomeMessage"),
            suggestions: defaultSuggestions,
          }}
          strings={{
            composer: {
              input: {
                placeholder: t("chat.page.inputPlaceholder"),
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default ChatPage;
