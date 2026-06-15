import {
  isErrorMessage,
  THREAD_ACCESS_ERROR_MESSAGE,
} from "@/utils/index.js";

/** True when a service error should be hidden as a not-found response. */
export const isThreadAccessError = (error: unknown): boolean =>
  isErrorMessage(error, THREAD_ACCESS_ERROR_MESSAGE);

