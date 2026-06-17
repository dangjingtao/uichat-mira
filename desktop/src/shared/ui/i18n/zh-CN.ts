const ui = {
  ui: {
    errorBoundary: {
      defaultMessage: "界面遇到了一点问题。",
      unknownError: "发生了未知错误。",
      title: "页面暂时出了点问题",
      retry: "重试",
      reload: "刷新应用",
      viewDetails: "查看错误详情",
      retryOrReload: "你可以先重试一次，或者直接刷新应用。",
      pageLoadFailed: "当前页面加载失败了。你可以先刷新应用，再试一次。",
      routeErrorTitle: "页面加载失败",
    },
    fileUploadDropzone: {
      dragAndDrop: "拖拽文件或文件夹到此，或者",
      selectFile: "选择文件",
    },
    fileListItem: {
      removeFile: "删除文件",
    },
    statusIndicator: {
      running: "运行中",
      stopped: "已停止",
      unknown: "处理中",
    },
  },
} as const;

export default ui;
