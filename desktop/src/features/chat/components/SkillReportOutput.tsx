"use client";

import type { ChatMessage } from "@/shared/uchat/core";
import { DesktopChatArtifactSlot } from "./DesktopChatArtifactSlot";

/**
 * Compatibility adapter for the existing desktop message extension.
 * UChat owns only the generic extension position; artifact selection and
 * rendering stay in the desktop host registry.
 */
export function SkillReportOutput({ message }: { message: ChatMessage }) {
  return <DesktopChatArtifactSlot message={message} />;
}
