const roleTranslations = {
  page: {
    miniTitle: "Roles",
    title: "Roles",
    description: "Turn roles into a role design workbench.",
  },
  actions: {
    new: "New Role",
    import: "Import Role",
    delete: "Delete Role",
    preview: "Preview",
    guide: "Field Guide",
    editContent: "Edit Content",
    copySuffix: "Copy",
  },
  editor: {
    title: "Edit Role",
    hint: "Adjust role definition and prompt structure.",
  },
  list: {
    title: "Role List",
    hint: "Reusable prompt prototypes live here.",
    empty: "No roles yet. Create one to get started.",
  },
  fields: {
    title: "Core Fields",
    hint: "Each field opens in its own drawer, while the main surface stays summary-first.",
    empty: "Not filled yet",
  },
  llmProfile: {
    title: "Model Parameters",
    empty: "No role-specific generation settings yet. Chat defaults will be used.",
    configuredCount: "{{count}} configured",
    drawer: {
      title: "Role Model Parameters",
      hint: "Set dedicated generation parameters for this role. Blank fields continue to use the chat defaults.",
      note: "These settings only affect replies generated with this role and do not change other roles or the global chat setup.",
      close: "Close model parameters drawer",
      closeMask: "Close role model parameters",
    },
    messages: {
      saved: "Role model parameters saved",
      saveFailed: "Failed to save role model parameters",
    },
    fields: {
      temperature: {
        label: "Temperature",
        placeholder: "For example 0.7",
        tooltip: "Controls variation in the reply. Lower values stay steadier, higher values allow more freedom.",
      },
      topP: {
        label: "Top P",
        placeholder: "For example 0.9",
        tooltip: "Limits the probability mass considered at each step. Lower values keep the model closer to high-confidence options.",
      },
      topK: {
        label: "Top K",
        placeholder: "For example 40",
        tooltip: "Limits how many token candidates are considered at each step. Lower values make output more concentrated.",
      },
      maxTokens: {
        label: "Max Output",
        placeholder: "For example 1024",
        tooltip: "Caps the maximum length of a single reply to control verbosity and cost.",
      },
      frequencyPenalty: {
        label: "Frequency Penalty",
        placeholder: "For example 0.3",
        tooltip: "Reduces the chance of repeating the same wording again and again.",
      },
      presencePenalty: {
        label: "Presence Penalty",
        placeholder: "For example 0.2",
        tooltip: "Encourages the model to introduce new wording or fresh angles.",
      },
    },
  },
  status: {
    published: "Published",
    draft: "Draft",
  },
  header: {
    previewOnly: "Prompt prototype",
  },
  form: {
    name: "Name",
    summary: "Summary",
    tags: "Tags",
    tagsHelp: "Up to 3 tags for filtering and scanning.",
    tagsPlaceholder: "Type and press Enter",
    description: "Description",
    descriptionHelp:
      "Defines who the role is, what it does, and where it comes from.",
    persona: "Persona",
    personaHelp: "Defines role identity and tone.",
    scenario: "Scenario",
    scenarioHelp: "Defines the usage scenario.",
    worldview: "Worldview",
    worldviewHelp: "Defines the role's basic view of the world.",
    exampleDialogues: "Example Dialogues",
    exampleDialoguesHelp: "Add representative Q&A snippets.",
    style: "Writing Style",
    constraints: "Constraints",
    errors: {
      nameRequired: "Role name is required.",
      nameTooLong: "Role name cannot exceed {{max}} characters.",
      summaryTooLong: "Summary cannot exceed {{max}} characters.",
    },
    coreContentEmpty:
      "Description, persona, and scenario are all empty. The model may not recognize this role.",
  },
  preview: {
    title: "Prompt Preview",
    hint: "Inspect the assembled result with knowledge base context.",
    chat: "Chat",
    rag: "RAG",
    testInput: "Test input",
    stackTitle: "Context Stack",
    blockTitle: "Prompt Block Preview",
    mode: "Mode",
    persona: "Role",
    roleName: "Role Name",
    roleSummary: "Role Summary",
    roleDescription: "Role Description",
    roleWorldview: "Worldview",
    rolePersona: "Persona Core",
    roleScenario: "Scenario",
    roleExamples: "Example Dialogues",
    roleStyle: "Writing Style",
    roleConstraints: "Constraints",
    input: "Input",
    systemPrompt:
      "System prompts hold product-wide rules and safety boundaries.",
    knowledgeInjected: "Knowledge base context is injected before generation.",
    knowledgeSkipped: "Previewing role only, without knowledge context.",
    close: "Close preview",
    closeMask: "Close prompt preview",
    layers: {
      system: "System Layer",
      role: "Role Layer",
      knowledge: "Knowledge Layer",
      history: "History Layer",
    },
    historyNotice:
      "History keeps context continuity, but it does not replace role definition.",
    chatView: {
      hint: "This shows how the role is expected to sound in a normal chat.",
      replyIntro: "I will respond according to the current role setup first.",
      replySummary: "Current role impression: {{summary}}",
      replyScenario: "I will frame this within: {{scenario}}",
      replyTask: "Your current request is: {{input}}",
      replyPersona: "I will keep this role stance: {{persona}}",
      replyStyle: "The wording will lean toward: {{style}}",
      replyConstraint: "I will keep this boundary in place: {{constraints}}",
      replyClosing:
        "If the request still lacks detail, I will give a careful judgment first and then point out what is still missing.",
    },
  },
  prompt: {
    notice: "Prompt block preview.",
  },
  guide: {
    name: {
      title: "Name",
      description: "The quickest way to identify the role.",
    },
    description: {
      title: "Description",
      description:
        "Who the role is, what it looks like, what it does, and where it comes from.",
    },
    worldview: {
      title: "Worldview",
      description: "The role's underlying view of the world.",
    },
    persona: {
      title: "Persona",
      description: "Identity, tone, and stable behavior.",
    },
    scenario: {
      title: "Scenario",
      description: "The kind of situation this role works in.",
    },
    exampleDialogues: {
      title: "Example Dialogues",
      description: "Show how the role usually responds.",
    },
    style: {
      title: "Writing Style",
      description: "Controls sentence length, tone, and density.",
    },
    constraints: {
      title: "Constraints",
      description: "Hard boundaries the role should not cross.",
    },
  },
  content: {
    title: "Role Content",
    hint: "Compose the core fields here; the main surface only keeps name and summary.",
    close: "Close editor",
    closeMask: "Close role content",
  },
  fieldDrawer: {
    close: "Close field editor",
    closeMask: "Close field editor drawer",
  },
  fieldHelp: {
    syntax: "Suggested Pattern",
    good: "Good Example",
    bad: "Avoid",
  },
  fieldNotes: {
    description:
      "Define the role's identity, background, appearance, occupation, and position in the world. Use factual sentences rather than decorative prose. This is the skeleton that keeps the role recognizable across different scenarios.",
    worldview:
      "Define the role's underlying model of the world and how it reasons through problems. This is the base layer for later judgment, tradeoffs, and framing.",
    persona:
      "Define identity, stance, relationship tone, and stable behavior. This decides who the role is and how it tends to respond, rather than describing a temporary task.",
    scenario:
      "Limit the role's usual working context, task space, and target boundary. This helps the model decide when to take initiative and when to stay restrained.",
    exampleDialogues:
      "Provide a few high-value examples that show how the role responds, advances, refuses, or clarifies. Keep them selective and representative rather than exhaustive.",
    style:
      "Constrain expression: sentence shape, pacing, answer length, information density, and tone. This controls how the role speaks, not which facts it uses.",
    constraints:
      "State hard boundaries, required rules, and conflict priorities. Use this field for non-negotiable guardrails instead of repeating persona description.",
  },
  fieldExamples: {
    description: {
      syntax:
        "Write factual sentences covering:\n- Identity or occupation\n- Appearance or notable traits\n- Background or world position\n- Relationship with {{user}}",
      good: "Aileen is an intelligence liaison working in a border city, skilled at gathering information and spotting lies. She dresses practically, always carries a notebook, and keeps her distance from strangers until she decides they are reliable.",
      bad: "You are very wise and deep.\nYou are an amazing character.\nPlease help me finish this task.",
    },
    worldview: {
      syntax:
        "Cover three things in order:\n- What the role believes\n- How it judges facts and risk\n- What it prioritizes in conflict",
      good: "You believe conclusions should be grounded in evidence.\nWhen information conflicts, you separate assumptions from verified facts first.\nIf speed and accuracy compete, you protect accuracy before polish.",
      bad: "You are very wise and deep.\nYou have a good worldview.\nPlease help me finish this report now.",
    },
    persona: {
      syntax:
        "Write three stable parts:\nRole identity: ...\nAttitude toward {{user}}: ...\nStable behavior: ...",
      good: "Role identity: You are a restrained product review assistant who leads with the conclusion.\nAttitude toward {{user}}: You stay collaborative and professional without flattery.\nStable behavior: You first decide whether a claim holds, then explain the reason and next step.",
      bad: "You are kind, smart, and amazing.\nYou can do everything.\nYour task right now is to rewrite my article.",
    },
    scenario: {
      syntax:
        "Treat this like stage directions:\nPlace or environment: ...\nRelationship: ...\nCurrent situation: ...\nGoal or tone: ...",
      good: "Place or environment: The team is reviewing a feature that is close to launch.\nRelationship: {{user}} owns the project and you are the reviewer.\nCurrent situation: The proposal is incomplete, but a directional judgment is needed.\nGoal or tone: Keep the exchange professional, restrained, and decision-oriented.",
      bad: "You grew up in a complicated world.\nYou are a cautious person.\nIn the end everyone succeeds and celebrates.",
    },
    exampleDialogues: {
      syntax:
        "Use short multi-turn dialogue:\n{{user}}: ...\n{{char}}: ...\n\nEach block should show one clear speaking pattern.",
      good: "{{user}}: Can this plan ship?\n{{char}}: Yes, but only after the rollback path and exception flow are covered.\n\n{{user}}: Why do you start with risk?\n{{char}}: Because the cost of missing it later is usually higher.",
      bad: "The role usually analyzes first and then gives advice.\nThis section should feel professional.\nHere are some general product principles: ...",
    },
    style: {
      syntax:
        "Focus only on expression:\nSentence length: ...\nTone: ...\nStructure: ...\nInformation density: ...",
      good: "Sentence length: Prefer short sentences, then extend only when needed.\nTone: Calm and direct, without exaggeration.\nStructure: Lead with the conclusion, then expand in bullets.\nInformation density: Keep filler low and preserve the reasoning.",
      bad: "You are a product expert.\nYou know many industry facts.\nYou help users solve every problem.",
    },
    constraints: {
      syntax:
        "Use explicit rules with visible priority:\nMust: ...\nMust not: ...\nWhen rules conflict, prioritize: ...",
      good: "Must: Keep conclusions tied to information the user actually provided.\nMust not: Invent unverified facts or numbers.\nWhen rules conflict, prioritize accuracy before completeness.",
      bad: "Try to do better.\nDo not be weird.\nAnswer depending on the situation.",
    },
  },
  messages: {
    created: "Created a new role draft",
    imported: "Imported role copy",
    saved: "Role saved",
    createFailed: "Failed to create role",
    saveFailed: "Failed to save role",
    loadFailed: "Failed to load roles",
    deleted: "Role {{name}} deleted",
    reset: "Restored current role state",
    validationFailed: "Please fix the form errors before saving.",
  },
  deleteModal: {
    title: "Delete Role",
    description: 'This will delete role "{{name}}".',
    confirm: "Delete",
  },
  defaults: {
    newName: "Untitled Role",
    newSummary: "Start from scratch with a prompt structure.",
    newTag1: "Draft",
    newDescription:
      "The role's identity, background, and appearance are not configured yet.",
    newTag2: "Unconfigured",
    newWorldview: "Your worldview is not configured yet.",
    newPersona: "You are a role waiting to be configured.",
    newScenario: "Good for authoring a role prompt from scratch.",
    newExampleDialogues: "Example dialogues have not been written yet.",
    newStyle: "Keep it concise, editable, and reusable.",
    newConstraints: "Do not inject extra context yet.",
    previewInput: "Help me turn this into a conclusion.",
  },
  presets: {
    formalReviewer: {
      name: "Formal Reviewer",
      summary: "For reviews, summaries, and structured output.",
      tags: {
        strict: "Strict",
        concise: "Lead with Conclusion",
        structured: "Structured",
      },
      prompt: {
        description:
          "You are a careful, restrained product review assistant specialized in structured analysis, evidence-backed conclusions, and concise communication.",
        worldview:
          "You believe conclusions should come before elaboration, and facts should come before rhetoric.",
        persona:
          "You are a careful, restrained product review assistant that leads with the conclusion.",
        scenario:
          "Useful for reviews, summaries, analysis, and evidence-backed suggestions.",
        exampleDialogues:
          "{{user}}: Can this plan work?\n{{char}}: Yes, but only after the boundaries and dependencies are made explicit.",
        style:
          "Lead with the conclusion, then expand; prefer short sentences and bullets.",
        constraints:
          "Do not exaggerate, stay concrete, and avoid unrelated digressions.",
      },
    },
    pilotHelper: {
      name: "Pilot Helper",
      summary:
        "For daily collaboration, task breakdown, and light companionship.",
      tags: {
        collaborative: "Collaborative",
        clear: "Clear",
        light: "Light",
      },
      prompt: {
        description:
          "You are a friendly, clear collaboration assistant who helps users break complex problems into small executable steps.",
        worldview:
          "You believe complex problems should be broken into small executable steps.",
        persona:
          "You are a friendly, clear collaboration assistant who helps break tasks down.",
        scenario:
          "Useful for everyday Q&A, task decomposition, project work, and todo organization.",
        exampleDialogues:
          "{{user}}: I need to build the role page.\n{{char}}: Start with the fields, then the preview, then the save path.",
        style:
          "Natural tone; ask follow-ups when needed; give a concrete next step.",
        constraints:
          "Do not overclaim, do not pretend certainty, and avoid heavy formality.",
      },
    },
    archiveGuide: {
      name: "Archive Guide",
      summary:
        "For knowledge browsing, material organization, and archival expression.",
      tags: {
        archive: "Archive",
        retrieval: "Retrieval",
        order: "Organize",
      },
      prompt: {
        description:
          "You are a knowledge assistant good at organizing material, tracing sources, and helping users navigate archived information.",
        worldview:
          "You believe information becomes valuable when it is traceable and well organized.",
        persona:
          "You are a knowledge assistant good at organizing material and helping users trace history.",
        scenario:
          "Useful for knowledge organization, history tracking, summaries, and archiving records.",
        exampleDialogues:
          "{{user}}: What matters most in this material?\n{{char}}: I will give you the structure first, then the summary, then the sources.",
        style: "Prefer citations; stay steady; emphasize traceability.",
        constraints: "Do not write the summary like marketing copy.",
      },
    },
  },
} as const;

export default roleTranslations;
