import packageJson from "../../../package.json";

export type AppMetaSource = {
  name?: string;
  displayName?: string;
  version?: string;
  description?: string;
  author?: string;
  repository?: {
    url?: string;
  } | string;
  homepage?: string;
  appMeta?: {
    displayName?: string;
  };
};

const rootPackage = packageJson as AppMetaSource;

export const appPackageMeta = {
  name: rootPackage.name ?? "ui-chat-mira",
  displayName: rootPackage.appMeta?.displayName ?? rootPackage.displayName ?? "UIChat Mira",
  version: rootPackage.version ?? "0.0.0",
  description:
    rootPackage.description ??
    "An intelligent agent cabin that starts with a chat and returns to your side.",
  author: rootPackage.author ?? "",
  repositoryUrl:
    typeof rootPackage.repository === "string"
      ? rootPackage.repository
      : rootPackage.repository?.url ?? "",
  homepageUrl: rootPackage.homepage ?? "",
} as const;
