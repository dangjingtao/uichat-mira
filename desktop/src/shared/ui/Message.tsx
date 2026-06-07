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

  if (!globalMessageApi) {
    globalMessageApi = api;
  }

  const getIcon = (type: MessageType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />;
      case "warning":
        return (
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
        );
      case "info":
        return <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />;
      case "loading":
        return (
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
        );
    }
  };

  return (
    <MessageContext.Provider value={api}>
      {children}
      <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
        {messages.map((msg) => (
          <div
            key={msg.key}
            className="pointer-events-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-[500px] animate-in fade-in slide-in-from-top-2 duration-200"
          >
            {getIcon(msg.type)}
            <div className="flex-1 text-sm text-gray-800 dark:text-gray-200">
              {msg.content}
            </div>
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
    if (globalMessageApi) {
      globalMessageApi.open(config);
    }
  },
  success: (content, duration) => {
    if (globalMessageApi) {
      globalMessageApi.success(content, duration);
    }
  },
  error: (content, duration) => {
    if (globalMessageApi) {
      globalMessageApi.error(content, duration);
    }
  },
  warning: (content, duration) => {
    if (globalMessageApi) {
      globalMessageApi.warning(content, duration);
    }
  },
  info: (content, duration) => {
    if (globalMessageApi) {
      globalMessageApi.info(content, duration);
    }
  },
  loading: (content, duration) => {
    if (globalMessageApi) {
      globalMessageApi.loading(content, duration);
    }
  },
  destroy: () => {
    if (globalMessageApi) {
      globalMessageApi.destroy();
    }
  },
});

export const message = createStaticApi();
