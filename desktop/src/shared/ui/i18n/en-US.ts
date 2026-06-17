const ui = {
  ui: {
    errorBoundary: {
      defaultMessage: "Something went wrong with the interface.",
      unknownError: "An unknown error occurred.",
      title: "The page is temporarily having issues",
      retry: "Retry",
      reload: "Reload App",
      viewDetails: "View error details",
      retryOrReload: "You can try again or reload the application.",
      pageLoadFailed: "Failed to load the current page. Try reloading the app.",
      routeErrorTitle: "Page Load Failed",
    },
    fileUploadDropzone: {
      dragAndDrop: "Drag and drop files or folders here, or",
      selectFile: "select files",
    },
    fileListItem: {
      removeFile: "Remove file",
    },
    statusIndicator: {
      running: "Running",
      stopped: "Stopped",
      unknown: "Processing",
    },
  },
} as const;

export default ui;
