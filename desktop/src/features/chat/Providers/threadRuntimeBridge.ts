let currentThreadRemoteId: string | null = null;

export const setCurrentThreadRemoteIdForTransport = (
  remoteId: string | null,
) => {
  currentThreadRemoteId = remoteId;
};

export const getCurrentThreadRemoteIdForTransport = () =>
  currentThreadRemoteId;
