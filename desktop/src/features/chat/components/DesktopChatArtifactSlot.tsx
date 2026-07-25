"use client";

import type { ComponentType } from "react";
import type { ChatMessage } from "@/shared/uchat/core";
import {
  readSkillReportArtifactMarker,
  SkillReportArtifactRenderer,
} from "./SkillReportArtifactRenderer";

type DesktopChatArtifactRenderer = {
  kind: string;
  matches: (message: ChatMessage) => boolean;
  Component: ComponentType<{ message: ChatMessage }>;
};

const artifactRenderers: readonly DesktopChatArtifactRenderer[] = [
  {
    kind: "skill-report",
    matches: (message) => Boolean(readSkillReportArtifactMarker(message)),
    Component: SkillReportArtifactRenderer,
  },
];

export const resolveDesktopChatArtifactKind = (message: ChatMessage) =>
  artifactRenderers.find((renderer) => renderer.matches(message))?.kind ?? null;

export function DesktopChatArtifactSlot({
  message,
}: {
  message: ChatMessage;
}) {
  const renderer = artifactRenderers.find((candidate) =>
    candidate.matches(message),
  );
  if (!renderer) return null;

  const ArtifactRenderer = renderer.Component;
  return (
    <div
      className="mt-3 min-w-0"
      data-uchat-slot="message-artifact"
      data-artifact-kind={renderer.kind}
      data-message-id={message.id}
    >
      <ArtifactRenderer message={message} />
    </div>
  );
}
