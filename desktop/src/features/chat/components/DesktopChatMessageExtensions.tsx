"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Image as ImageIcon, LoaderCircle, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getChatMediaPreviewUrl } from "@/shared/api/thread";
import type { ChatMessage } from "@/shared/uchat/core";
import type { UChatMessageExtensionProps } from "@/shared/uchat/ui";
import { SkillReportOutput } from "./SkillReportOutput";

const actionButtonClassName =
  "inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-surface-primary/92 text-text-secondary transition-colors hover:border-border hover:bg-surface-primary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";

type ChatMediaEntry = {
  status?: "queued" | "running" | "succeeded" | "failed";
  mediaId?: string;
  errorMessage?: string;
};

type DesktopChatMediaContextValue = {
  onRequestTts: (message: ChatMessage) => void | Promise<void>;
  requestImage?: (message: ChatMessage) => Promise<void>;
  pendingImageMessageIds: ReadonlySet<string>;
  showImageAction: boolean;
};

const DesktopChatMediaContext =
  createContext<DesktopChatMediaContextValue | null>(null);

export function DesktopChatMessageExtensionsProvider({
  children,
  onRequestTts,
  onRequestImage,
  showImageAction,
}: {
  children: React.ReactNode;
  onRequestTts: (message: ChatMessage) => void | Promise<void>;
  onRequestImage?: (message: ChatMessage) => void | Promise<void>;
  showImageAction: boolean;
}) {
  const [pendingImageMessageIds, setPendingImageMessageIds] = useState(
    () => new Set<string>(),
  );
  const requestImage = useCallback(
    async (message: ChatMessage) => {
      if (!onRequestImage) return;
      setPendingImageMessageIds((current) => {
        const next = new Set(current);
        next.add(message.id);
        return next;
      });
      try {
        await onRequestImage(message);
      } finally {
        setPendingImageMessageIds((current) => {
          const next = new Set(current);
          next.delete(message.id);
          return next;
        });
      }
    },
    [onRequestImage],
  );
  const value = useMemo<DesktopChatMediaContextValue>(
    () => ({
      onRequestTts,
      requestImage: onRequestImage ? requestImage : undefined,
      pendingImageMessageIds,
      showImageAction,
    }),
    [
      onRequestImage,
      onRequestTts,
      pendingImageMessageIds,
      requestImage,
      showImageAction,
    ],
  );

  return (
    <DesktopChatMediaContext.Provider value={value}>
      {children}
    </DesktopChatMediaContext.Provider>
  );
}

const useDesktopChatMedia = () => {
  const value = useContext(DesktopChatMediaContext);
  if (!value) {
    throw new Error(
      "DesktopChatMessageExtensions requires DesktopChatMessageExtensionsProvider",
    );
  }
  return value;
};

const revokeObjectUrl = (value: string | null) => {
  if (value && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(value);
  }
};

function ChatMediaOutput({
  message,
  onPreviewImage,
}: Pick<UChatMessageExtensionProps, "message" | "onPreviewImage">) {
  const { t } = useTranslation();
  const { requestImage, showImageAction } = useDesktopChatMedia();
  const media = message.metadata?.media as
    | { image?: ChatMediaEntry; tts?: ChatMediaEntry }
    | undefined;
  const image = media?.image;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setImageUrl(null);
    setImageError(null);
    if (image?.status === "succeeded" && image.mediaId) {
      setImageLoading(true);
      void getChatMediaPreviewUrl(message.threadId, image.mediaId)
        .then((url) => {
          if (disposed) revokeObjectUrl(url);
          else {
            objectUrl = url;
            setImageUrl(url);
          }
        })
        .catch((error) => {
          if (!disposed) {
            setImageError(
              error instanceof Error
                ? error.message
                : t("chat.thread.media.loadFailed"),
            );
          }
        })
        .finally(() => {
          if (!disposed) setImageLoading(false);
        });
    } else {
      setImageLoading(false);
    }
    return () => {
      disposed = true;
      revokeObjectUrl(objectUrl);
    };
  }, [image?.mediaId, image?.status, message.threadId, t]);

  if (!image) return null;

  return (
    <div className="mt-3 space-y-2">
      {image.status === "queued" ||
      image.status === "running" ||
      imageLoading ? (
        <div className="inline-flex items-center gap-2 text-xs text-text-secondary">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          {t("chat.thread.media.imageGenerating")}
        </div>
      ) : null}
      {image.status === "failed" || imageError ? (
        <div className="flex flex-wrap items-center gap-2 text-xs text-danger-text">
          <span>
            {t("chat.thread.media.imageFailed")}: {image.errorMessage ?? imageError}
          </span>
          {showImageAction && requestImage ? (
            <button
              type="button"
              className="font-medium underline underline-offset-2"
              onClick={() => void requestImage(message)}
            >
              {t("chat.thread.media.retry")}
            </button>
          ) : null}
        </div>
      ) : null}
      {imageUrl ? (
        <button
          type="button"
          className="block max-w-[min(100%,22rem)] overflow-hidden rounded-[14px] border border-border/70"
          onClick={() => onPreviewImage(imageUrl)}
          aria-label={t("chat.thread.media.previewImage")}
        >
          <img
            src={imageUrl}
            alt={t("chat.thread.media.generatedImage")}
            className="block max-h-[18rem] w-full object-contain"
          />
        </button>
      ) : null}
    </div>
  );
}

function ChatMediaAudioAction({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const { onRequestTts } = useDesktopChatMedia();
  const tts = (message.metadata?.media as { tts?: ChatMediaEntry } | undefined)
    ?.tts;
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl: string | null = null;
    setIsPlaying(false);
    setAudioError(null);
    if (tts?.status === "succeeded" && tts.mediaId) {
      void getChatMediaPreviewUrl(message.threadId, tts.mediaId)
        .then((url) => {
          if (disposed) revokeObjectUrl(url);
          else {
            objectUrl = url;
            setAudioUrl(url);
            const audio = audioRef.current;
            if (audio) {
              audio.src = url;
              audio.load();
            }
          }
        })
        .catch((error) => {
          if (!disposed) {
            setAudioUrl(null);
            setAudioError(
              error instanceof Error
                ? error.message
                : t("chat.thread.media.audioLoadFailed"),
            );
          }
        });
    } else {
      setAudioUrl(null);
    }
    return () => {
      disposed = true;
      revokeObjectUrl(objectUrl);
    };
  }, [message.threadId, t, tts?.mediaId, tts?.status]);

  const play = async () => {
    setBusy(true);
    setAudioError(null);
    try {
      let playableUrl = audioUrl;
      if (!playableUrl && tts?.status === "succeeded" && tts.mediaId) {
        playableUrl = await getChatMediaPreviewUrl(message.threadId, tts.mediaId);
        setAudioUrl(playableUrl);
      }
      if (playableUrl) {
        const audio = audioRef.current ?? new Audio(playableUrl);
        if (audio.src !== playableUrl) {
          audio.src = playableUrl;
          audio.load();
        }
        await audio.play();
        setIsPlaying(true);
      } else {
        await onRequestTts(message);
      }
    } catch (error) {
      setIsPlaying(false);
      if (tts?.status === "succeeded" && tts.mediaId) {
        setAudioUrl(null);
        try {
          await onRequestTts(message);
          return;
        } catch (regenerationError) {
          setAudioError(
            regenerationError instanceof Error
              ? regenerationError.message
              : t("chat.thread.media.audioPlayFailed"),
          );
        }
      } else {
        setAudioError(
          error instanceof Error
            ? error.message
            : t("chat.thread.media.audioPlayFailed"),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-1">
      <audio
        ref={audioRef}
        preload="auto"
        aria-hidden="true"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      />
      <button
        type="button"
        className={actionButtonClassName}
        onClick={() => void play()}
        disabled={busy || tts?.status === "running"}
        aria-label={t("chat.thread.media.playAudio")}
        title={t("chat.thread.media.playAudio")}
      >
        {busy || tts?.status === "running" ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : isPlaying ? (
          <span
            className="relative inline-flex h-3.5 w-3.5 items-center justify-center text-primary"
            data-testid="chat-media-audio-playing"
            aria-hidden="true"
          >
            <span className="absolute inset-0 rounded-full bg-primary/15 motion-safe:animate-ping" />
            <Volume2 className="relative h-3.5 w-3.5 motion-safe:animate-pulse" />
          </span>
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>
      {tts?.status === "failed" ? (
        <span className="text-xs text-danger-text">
          {t("chat.thread.media.audioFailed")}: {tts.errorMessage ?? t("chat.thread.media.unknownError")}
        </span>
      ) : null}
      {audioError ? (
        <span className="text-xs text-danger-text">
          {t("chat.thread.media.audioPlayFailed")}: {audioError}
        </span>
      ) : null}
    </span>
  );
}

function ChatMediaImageAction({ message }: { message: ChatMessage }) {
  const { t } = useTranslation();
  const {
    pendingImageMessageIds,
    requestImage,
    showImageAction,
  } = useDesktopChatMedia();
  const image = (
    message.metadata?.media as { image?: ChatMediaEntry } | undefined
  )?.image;
  const isRunning =
    pendingImageMessageIds.has(message.id) ||
    image?.status === "queued" ||
    image?.status === "running";

  if (!showImageAction || !requestImage) return null;

  return (
    <button
      type="button"
      className={actionButtonClassName}
      onClick={() => void requestImage(message)}
      disabled={isRunning}
      aria-label={t("chat.thread.media.generateImage")}
      title={t("chat.thread.media.generateImage")}
    >
      {isRunning ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ImageIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export function DesktopChatMessageExtensions({
  message,
  placement,
  onPreviewImage,
}: UChatMessageExtensionProps) {
  if (placement === "content") {
    return (
      <>
        <ChatMediaOutput
          message={message}
          onPreviewImage={onPreviewImage}
        />
        <SkillReportOutput message={message} />
      </>
    );
  }

  return (
    <>
      <ChatMediaAudioAction message={message} />
      <ChatMediaImageAction message={message} />
    </>
  );
}
