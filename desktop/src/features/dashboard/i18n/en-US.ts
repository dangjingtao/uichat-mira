const dashboard = {
  dashboard: {
    home: {
      welcomeBack: "Welcome back, {{username}}",
      startTest: "Start Testing",
      logout: "Log Out",
      backendService: "Backend Service",
      databaseConnection: "Database Connection",
      runtime: "Runtime",
      subtitle:
        "Once the system is healthy, move straight into chat testing, retrieval, and review.",
      currentUser: "Current User",
      userHint: "Keep this page quiet. The real work starts in the chat workspace.",
      quickStartLabel: "Quick Start",
      quickStartHint: "This page only confirms readiness and sends you into the main flow.",
      openWorkspace: "Open Chat Workspace",
    },
  },
} as const;

export default dashboard;
