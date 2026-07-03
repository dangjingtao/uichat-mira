import {
  BookOpenText,
  BookText,
  Globe2,
  MessagesSquare,
  PenLine,
  ShieldAlert,
  User,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { RoleField, FieldMeta, RoleRecord } from "./types";

export const ROLE_FIELDS: RoleField[] = [
  "description",
  "worldview",
  "persona",
  "scenario",
  "exampleDialogues",
  "style",
  "constraints",
];

export const FIELD_META: Record<RoleField, FieldMeta> = {
  description: { icon: BookText },
  worldview: { icon: Globe2 },
  persona: { icon: User },
  scenario: { icon: BookOpenText },
  exampleDialogues: { icon: MessagesSquare },
  style: { icon: PenLine },
  constraints: { icon: ShieldAlert },
};

export function buildStarterRoles(t: TFunction): RoleRecord[] {
  return [
    {
      id: "formal-reviewer",
      name: t("presets.formalReviewer.name"),
      summary: t("presets.formalReviewer.summary"),
      avatarId: "formal-reviewer",
      status: "active",
      tags: [
        t("presets.formalReviewer.tags.strict"),
        t("presets.formalReviewer.tags.concise"),
        t("presets.formalReviewer.tags.structured"),
      ],
      llmProfile: {},
      prompt: {
        description: t("presets.formalReviewer.prompt.description"),
        worldview: t("presets.formalReviewer.prompt.worldview"),
        persona: t("presets.formalReviewer.prompt.persona"),
        scenario: t("presets.formalReviewer.prompt.scenario"),
        exampleDialogues: t("presets.formalReviewer.prompt.exampleDialogues"),
        style: t("presets.formalReviewer.prompt.style"),
        constraints: t("presets.formalReviewer.prompt.constraints"),
      },
    },
    {
      id: "pilot-helper",
      name: t("presets.pilotHelper.name"),
      summary: t("presets.pilotHelper.summary"),
      avatarId: "pilot-helper",
      status: "active",
      tags: [
        t("presets.pilotHelper.tags.collaborative"),
        t("presets.pilotHelper.tags.clear"),
        t("presets.pilotHelper.tags.light"),
      ],
      llmProfile: {},
      prompt: {
        description: t("presets.pilotHelper.prompt.description"),
        worldview: t("presets.pilotHelper.prompt.worldview"),
        persona: t("presets.pilotHelper.prompt.persona"),
        scenario: t("presets.pilotHelper.prompt.scenario"),
        exampleDialogues: t("presets.pilotHelper.prompt.exampleDialogues"),
        style: t("presets.pilotHelper.prompt.style"),
        constraints: t("presets.pilotHelper.prompt.constraints"),
      },
    },
    {
      id: "archive-guide",
      name: t("presets.archiveGuide.name"),
      summary: t("presets.archiveGuide.summary"),
      avatarId: "archive-guide",
      status: "draft",
      tags: [
        t("presets.archiveGuide.tags.archive"),
        t("presets.archiveGuide.tags.retrieval"),
        t("presets.archiveGuide.tags.order"),
      ],
      llmProfile: {},
      prompt: {
        description: t("presets.archiveGuide.prompt.description"),
        worldview: t("presets.archiveGuide.prompt.worldview"),
        persona: t("presets.archiveGuide.prompt.persona"),
        scenario: t("presets.archiveGuide.prompt.scenario"),
        exampleDialogues: t("presets.archiveGuide.prompt.exampleDialogues"),
        style: t("presets.archiveGuide.prompt.style"),
        constraints: t("presets.archiveGuide.prompt.constraints"),
      },
    },
  ];
}

export function createBlankRole(t: TFunction, id: string): RoleRecord {
  return {
    id,
    name: t("defaults.newName"),
    summary: t("defaults.newSummary"),
    avatarId: null,
    status: "draft",
    tags: [t("defaults.newTag1"), t("defaults.newTag2")],
    llmProfile: {},
    prompt: {
      description: t("defaults.newDescription"),
      worldview: t("defaults.newWorldview"),
      persona: t("defaults.newPersona"),
      scenario: t("defaults.newScenario"),
      exampleDialogues: t("defaults.newExampleDialogues"),
      style: t("defaults.newStyle"),
      constraints: t("defaults.newConstraints"),
    },
  };
}
