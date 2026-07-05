export type ArtifactStoreOptions = {
  rootDir: string;
  fetchImpl?: typeof fetch;
  now?: () => string;
  idFactory?: () => string;
};
