import os from "node:os";

const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/](?:.*)?$/;
const unixAbsolutePathPattern = /^\//;

export const isValidWorkspaceRootPath = (input: string) => {
  const rootPath = input.trim();
  if (!rootPath) {
    return false;
  }

  return os.platform() === "win32"
    ? windowsAbsolutePathPattern.test(rootPath)
    : unixAbsolutePathPattern.test(rootPath);
};
