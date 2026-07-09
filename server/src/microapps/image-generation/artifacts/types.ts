export type ArtifactStoreOptions = {
  rootDir: string;
  publicBaseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  idFactory?: () => string;
};
