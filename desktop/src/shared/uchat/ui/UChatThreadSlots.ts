import type { ComponentType } from "react";
import type { ChatMessage } from "../core";

export type UChatMessageExtensionPlacement = "content" | "actions";

export type UChatMessageExtensionProps = {
  message: ChatMessage;
  placement: UChatMessageExtensionPlacement;
  onPreviewImage: (src: string) => void;
  onRequestLayout: () => void;
};

export type UChatThreadSlots = {
  MessageExtensions?: ComponentType<UChatMessageExtensionProps>;
  ComposerTools?: ComponentType;
};
