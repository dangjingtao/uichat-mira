const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/](?:.*)?$/;
const windowsUncPathPattern = /^\\\\[^\\\/]+[\\\/][^\\\/]+/;
const posixAbsolutePathPattern = /^\//;

export const isValidWorkspaceRootPath = (
  input: string,
  platform = process.platform,
) => {
  const rootPath = input.trim();
  if (!rootPath) {
    return false;
  }

  if (platform !== "win32") {
    return posixAbsolutePathPattern.test(rootPath);
  }

  return (
    windowsAbsolutePathPattern.test(rootPath) ||
    windowsUncPathPattern.test(rootPath)
  );
};
