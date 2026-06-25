export type RequestContextThread = {
  roleId: string | null;
  contextSummary: string | null;
};

export type RequestContextMessage = {
  role: "system";
  content: string;
};

export type RequestContextResolver = (input: {
  thread: RequestContextThread;
  userId: number;
}) => RequestContextMessage | null;
