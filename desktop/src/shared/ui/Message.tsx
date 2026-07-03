import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { CheckCircle, XCircle, AlertCircle, Info, Loader2 } from "lucide-react";

type MessageType = "success" | "error" | "warning" | "info" | "loading";

interface MessageItem {
  key: string;
  content: ReactNode;
  type: MessageType;
  duration: number;
}

interface MessageContextType {
  open: (config: {
    content: ReactNode;
    type?: MessageType;
    duration?: number;
  }) => void;
  success: (content: ReactNode, duration?: number) => void;
  error: (content: ReactNode, duration?: number) => void;
  warning: (content: ReactNode, duration?: number) => void;
  info: (content: ReactNode, duration?: number) => void;
  loading: (content: ReactNode, duration?: number) => void;
  destroy: () => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

let globalMessageApi: MessageContextType | undefined;

export const MessageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const messageKeyCounter = useRef(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeMessage = useCallback((key: string) => {
    const timer = timers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(key);
    }
    setMessages((prev) => prev.filter((msg) => msg.key !== key));
  }, []);

  const open = useCallback(
    (config: { content: ReactNode; type?: MessageType; duration?: number }) => {
      const { content, type = "info", duration = 3 } = config;
      const key = `msg_${messageKeyCounter.current++}`;

      setMessages((prev) => [...prev, { key, content, type, duration }]);

      if (duration > 0) {
        const timer = setTimeout(() => removeMessage(key), duration * 1000);
        timers.current.set(key, timer);
      }
      return key;
    },
    [removeMessage],
  );

  const createTypedMethod =
    (type: MessageType) => (content: ReactNode, duration?: number) => {
      open({ content, type, duration });
    };

  const destroy = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setMessages([]);
  }, []);

  const api: MessageContextType = {
    open,
    success: createTypedMethod("success"),
    error: createTypedMethod("error"),
    warning: createTypedMethod("warning"),
    info: createTypedMethod("info"),
    loading: createTypedMethod("loading"),
    destroy,
  };

  globalMessageApi = api;

  const getIcon = (type: MessageType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 flex-shrink-0 text-success" />;
      case "error":
        return <XCircle className="h-5 w-5 flex-shrink-0 text-danger" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 flex-shrink-0 text-warning" />;
      case "info":
        return <Info className="h-5 w-5 flex-shrink-0 text-info" />;
      case "loading":
        return <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin text-info" />;
    }
  };

  return (
    <MessageContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed top-4 left-1/2 z-[220] flex -translate-x-1/2 flex-col items-center gap-2"
        aria-live="polite"
        aria-atomic="true"
      >
        {messages.map((msg) => (
          <div
            key={msg.key}
            className="pointer-events-auto flex min-w-[280px] max-w-[520px] items-center gap-3 rounded-ui-surface border border-border bg-surface-elevated/95 px-4 py-3 text-left shadow-shadow-lg backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200"
            role="status"
          >
            {getIcon(msg.type)}
            <div className="flex-1 text-sm text-text-primary">{msg.content}</div>
          </div>
        ))}
      </div>
    </MessageContext.Provider>
  );
};

export const useMessage = (): MessageContextType => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return context;
};

const createStaticApi = (): MessageContextType => ({
  open: (config) => {
    globalMessageApi?.open(config);
  },
  success: (content, duration) => {
    globalMessageApi?.success(content, duration);
  },
  error: (content, duration) => {
    globalMessageApi?.error(content, duration);
  },
  warning: (content, duration) => {
    globalMessageApi?.warning(content, duration);
  },
  info: (content, duration) => {
    globalMessageApi?.info(content, duration);
  },
  loading: (content, duration) => {
    globalMessageApi?.loading(content, duration);
  },
  destroy: () => {
    globalMessageApi?.destroy();
  },
});

export const message = createStaticApi();
