const dashboard = {
  dashboard: {
    home: {
      welcomeBack: "Welcome back, {{username}}",
      logout: "Log Out",
      backendService: "Backend Service",
      databaseConnection: "Database Connection",
      runtime: "Runtime",
      subtitle:
        "Once the system is healthy, move straight into chat testing, retrieval, and review.",
      currentUser: "Current User",
    },
  },
} as const;

export default dashboard;
