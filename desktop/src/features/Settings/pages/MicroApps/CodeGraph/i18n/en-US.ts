const codeGraphEn = {
  settings: {
    microApps: {
      studioEntries: {
        codeGraph: {
          title: "CodeGraph",
          description:
            "Manage codebase indexing, runtime status, and the Agent's controlled code-understanding capability.",
          actions: {
            open: "Open CodeGraph",
          },
        },
      },
      codeGraphStudio: {
        overview: {
          description:
            "Real CodeGraph now runs as a managed runtime. First start initializes and indexes the active workspace when needed; later runs reuse the local project index and CodeGraph keeps it synchronized.",
          nextSteps: {
            step1: {
              title: "Confirm App Data Root",
              description: "Keep logs and Mira-managed runtime data outside the repository.",
            },
            step2: {
              title: "Start CodeGraph",
              description: "Mira checks the provider and telemetry, then initializes the workspace index when required.",
            },
            step3: {
              title: "Allow Agent access",
              description: "Planner only sees the controlled codebase_explore tool; native CodeGraph commands remain internal.",
            },
          },
        },
        blockedCards: {
          externalIndex: {
            title: "Workspace-local index",
            description:
              "CodeGraph currently stores its project index in workspace/.codegraph. This is declared runtime data and no longer blocks startup.",
            badge: "Accepted",
          },
          pollutionGuard: {
            title: "Repo-local runtime data",
            description:
              "Mira preserves and reuses workspace/.codegraph without deleting user data; strict boundaries remain for other providers.",
            badge: "Controlled",
          },
        },
        cards: {
          blockedReasons: {
            emptyTitle: "No blockers detected",
            emptyDescription: "The current state has no conditions preventing CodeGraph from running.",
          },
          pollutionSummary: {
            title: "Local index summary",
            behavior: "Controlled workspace/.codegraph usage; never auto-delete",
            noticeTitle: "This is the CodeGraph project index, not a startup error.",
            noticeBody:
              "Real CodeGraph currently requires workspace/.codegraph. Mira treats it as declared runtime data while keeping logs and other managed data under App Data Root.",
          },
          capability: {
            agentCapabilityHint:
              "Allow the Agent to use CodeGraph. When runtime, telemetry, workspace, and App Data Root checks pass, Harness registers the single controlled codebase_explore tool.",
            unavailable:
              "codebase_explore is not available yet. Check the provider, telemetry, workspace, and App Data Root.",
          },
          actions: {
            title: "CodeGraph Runtime",
            description:
              "Start checks the provider and initializes the workspace index when needed. Stop only stops the runtime; it does not delete the index.",
            startHintBlocked:
              "A real startup blocker remains. Check the provider, telemetry, or App Data Root.",
            startHintFake:
              "Fake Provider is selected for development validation. Switch back to the real provider to run CodeGraph.",
          },
          smoke: {
            description:
              "Smoke uses the real managed runtime, CodeGraph query path, and source verification to confirm the Agent capability chain actually works.",
            realReady: "The real provider is ready for controlled smoke checks.",
            realBlocked: "The real provider is not ready yet. Start or inspect the runtime first.",
            realDisabledHint: "Runtime is not ready, so smoke is temporarily unavailable.",
          },
          smokeResult: {
            description:
              "This shows real runtime and controlled query results. Verified candidates are the proof that the code-evidence chain is working.",
          },
        },
        actions: {
          detect: "Detect Provider",
          start: "Start CodeGraph",
          health: "Check Status",
          stop: "Stop CodeGraph",
          smokeStatus: "Verify Runtime",
          smokeQuery: "Verify Code Query",
        },
        states: {
          emptySmoke:
            "No smoke result yet. Start CodeGraph, then verify the runtime and code-query chain.",
        },
      },
    },
  },
} as const;

export default codeGraphEn;
