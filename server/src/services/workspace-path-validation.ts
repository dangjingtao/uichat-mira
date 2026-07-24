const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/](?:.*)?$/;
const windowsUncPathPattern = /^\\\\[^\\\/]+[\\\/][^\\\/]+/;

export const isValidWorkspaceRootPath = (input: string) => {
  const rootPath = input.trim();
  if (!rootPath) {
    return false;
  }

  return (
    windowsAbsolutePathPattern.test(rootPath) ||
    windowsUncPathPattern.test(rootPath)
  );
};
