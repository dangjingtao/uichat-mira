export type ReadSourceKind = "text" | "document" | "table";

export type ReadSource = {
  kind: ReadSourceKind;
  mimeType: string;
  text: string;
  metadata: Record<string, unknown>;
};

export type ReadSliceWindow = {
  text: string;
  startLine: number;
  endLine: number;
  totalLines: number;
};

export type ReadDirectoryEntry = {
  name: string;
  type: "directory" | "file";
  sizeBytes: number;
  modifiedAt: string;
  listingStrategy: string;
  listingProvider: string;
};

export type ReadListResult = {
  type: "list";
  path: string;
  entries: ReadDirectoryEntry[];
};

export type ReadOpenResult = {
  type: "open";
  path: string;
  source: ReadSource;
  operation?: "open" | "extract";
  selection?: ReadSelection;
};

export type ReadSelection =
  | { kind: "lines"; start: number; end: number }
  | { kind: "range"; start: number; end: number };

export type ReadLocateMatch = {
  path: string;
  matchType: "path" | "content";
  line?: number;
  column?: number;
  preview?: string;
};

export type ReadLocateResult = {
  type: "locate";
  scope: string;
  query: string;
  searchMode: "auto" | "path" | "content";
  matches: ReadLocateMatch[];
};

export type ReadExtractResult = {
  type: "extract";
  path: string;
  source: ReadSource;
  slice: ReadSliceWindow;
};

export type ReadSliceResult = {
  type: "slice";
  slice: ReadSliceWindow;
};
