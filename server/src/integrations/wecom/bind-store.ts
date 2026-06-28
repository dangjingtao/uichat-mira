const threadBoundWecomUsers = new Map<string, string>();
const userBoundWecomUsers = new Map<number, string>();

export const bindWecomUserToThread = (threadId: string, userId: string) => {
  threadBoundWecomUsers.set(threadId, userId);
};

export const getBoundWecomUserForThread = (threadId: string) =>
  threadBoundWecomUsers.get(threadId) ?? null;

export const bindWecomUserToUser = (userId: number, externalUserId: string) => {
  userBoundWecomUsers.set(userId, externalUserId);
};

export const getBoundWecomUserForUser = (userId: number) =>
  userBoundWecomUsers.get(userId) ?? null;

export const clearWecomThreadBindings = () => {
  threadBoundWecomUsers.clear();
  userBoundWecomUsers.clear();
};
