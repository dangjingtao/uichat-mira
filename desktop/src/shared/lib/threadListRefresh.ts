const THREAD_LIST_REFRESH_EVENT = "rag-demo:thread-list-refresh";

export type ThreadListRefreshDetail = {
  remoteId?: string;
};

export const requestThreadListRefresh = (
  detail: ThreadListRefreshDetail = {},
) => {
  window.dispatchEvent(
    new CustomEvent<ThreadListRefreshDetail>(THREAD_LIST_REFRESH_EVENT, {
      detail,
    }),
  );
};

export const subscribeThreadListRefresh = (
  listener: (detail: ThreadListRefreshDetail) => void,
) => {
  const handleRefresh = (event: Event) => {
    listener((event as CustomEvent<ThreadListRefreshDetail>).detail ?? {});
  };

  window.addEventListener(THREAD_LIST_REFRESH_EVENT, handleRefresh);

  return () => {
    window.removeEventListener(THREAD_LIST_REFRESH_EVENT, handleRefresh);
  };
};
