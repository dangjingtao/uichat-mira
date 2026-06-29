const dashboard = {
  dashboard: {
    home: {
      previewLabel: "Dev Preview",
      welcomeBack: "Welcome back, {{username}}",
      enterChat: "Enter Chat",
      checkSettings: "Check Settings",
      enterMain: "Enter App",
      openSettings: "Open Settings",
      logout: "Log Out",
      backendService: "Backend Service",
      databaseConnection: "Database Connection",
      runtime: "Runtime",
      subtitle:
        "Connected to the local runtime and service status looks healthy. You can enter the chat workspace directly or review settings first.",
      currentUser: "Current User",
    },
  },
} as const;

export default dashboard;
