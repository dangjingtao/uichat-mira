const dashboard = {
  dashboard: {
    home: {
      welcomeBack: "Welcome back, {{username}}",
      enterMain: "Enter App",
      openSettings: "Open Settings",
      logout: "Log Out",
      backendService: "Backend Service",
      databaseConnection: "Database Connection",
      runtime: "Runtime",
      subtitle:
        "The browser preview is connected to the local runtime. Enter the chat workspace or check settings first.",
      currentUser: "Current User",
    },
  },
} as const;

export default dashboard;
