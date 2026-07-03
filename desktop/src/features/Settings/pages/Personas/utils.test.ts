import assert from "node:assert/strict";
import { test } from "vitest";
import {
  buildRolePreviewChatReply,
  normalizeLlmProfile,
  patchLlmProfileNumber,
  summarizeLlmProfile,
} from "./utils";

const createT = () => {
  const dictionary: Record<string, string> = {
    "llmProfile.empty": "Not configured",
    "llmProfile.fields.temperature.label": "Temperature",
    "llmProfile.fields.topP.label": "Top P",
    "llmProfile.fields.topK.label": "Top K",
    "llmProfile.fields.maxTokens.label": "Max Tokens",
    "llmProfile.fields.frequencyPenalty.label": "Frequency Penalty",
    "llmProfile.fields.presencePenalty.label": "Presence Penalty",
    "preview.chatView.replyIntro":
      "I will respond according to the current role setup first.",
    "preview.chatView.replySummary": "Current role impression: {{summary}}",
    "preview.chatView.replyScenario": "I will frame this within: {{scenario}}",
    "preview.chatView.replyTask": "Your current request is: {{input}}",
    "preview.chatView.replyPersona":
      "I will keep this role stance: {{persona}}",
    "preview.chatView.replyStyle": "The wording will lean toward: {{style}}",
    "preview.chatView.replyConstraint":
      "I will keep this boundary in place: {{constraints}}",
    "preview.chatView.replyClosing":
      "If the request still lacks detail, I will give a careful judgment first and then point out what is still missing.",
  };

  return (key: string, params?: Record<string, string>) => {
    const template = dictionary[key] ?? key;
    if (!params) {
      return template;
    }

    return Object.entries(params).reduce(
      (result, [paramKey, value]) =>
        result.replace(`{{${paramKey}}}`, String(value)),
      template,
    );
  };
};

test("normalizeLlmProfile keeps only finite numeric values", () => {
  assert.deepEqual(
    normalizeLlmProfile({
      temperature: 0.2,
      topP: Number.NaN,
      topK: 24,
      maxTokens: Number.POSITIVE_INFINITY,
    }),
    {
      temperature: 0.2,
      topK: 24,
    },
  );
});

test("patchLlmProfileNumber clears one key when the input becomes blank", () => {
  assert.deepEqual(
    patchLlmProfileNumber(
      {
        temperature: 0.2,
        topP: 0.9,
      },
      "topP",
      "   ",
    ),
    {
      temperature: 0.2,
    },
  );
});

test("summarizeLlmProfile returns a friendly compact summary", () => {
  const t = createT();

  assert.equal(
    summarizeLlmProfile(t, {
      temperature: 0.2,
      topP: 0.9,
      maxTokens: 768,
      presencePenalty: 0.3,
    }),
    "Temperature 0.2 · Top P 0.9 · Max Tokens 768",
  );
});

test("summarizeLlmProfile returns the empty label when nothing is configured", () => {
  const t = createT();
  assert.equal(summarizeLlmProfile(t, {}), "Not configured");
});

test("buildRolePreviewChatReply assembles a readable chat preview reply", () => {
  const t = createT();

  const reply = buildRolePreviewChatReply(t, {
    roleSummary: "A strict reviewer",
    persona: "Give the conclusion first",
    scenario: "Reviewing a release plan",
    style: "Short, structured sentences",
    constraints: "Do not invent facts",
    testInput: "Can we ship this tomorrow?",
  });

  assert.match(reply, /Current role impression: A strict reviewer/);
  assert.match(reply, /I will frame this within: Reviewing a release plan/);
  assert.match(reply, /Your current request is: Can we ship this tomorrow\?/);
  assert.match(reply, /I will keep this role stance: Give the conclusion first/);
});
