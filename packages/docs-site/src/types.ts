export type DocumentLifecycle =
  | "current"
  | "active"
  | "planning"
  | "historical"
  | "unverified";

export type VerificationState =
  | "fresh"
  | "stale"
  | "missing"
  | "invalid"
  | "not-required";

export interface GeneratedHeading {
  level: number;
  text: string;
  anchor: string;
}

export interface GeneratedDocument {
  id: string;
  path: string;
  title: string;
  section: string;
  metadata: {
    status: string | null;
    owner: string | null;
    lastVerified: string | null;
    layer: string | null;
    module: string | null;
    feature: string | null;
    docType: string | null;
    canonical: boolean;
  };
  lifecycle: DocumentLifecycle;
  verification: VerificationState;
  isPrimary: boolean;
  excerpt: string;
  headings: GeneratedHeading[];
  content: string;
}

export interface NavigationItem {
  title: string;
  path?: string;
  children?: NavigationItem[];
}

export interface GeneratedDocsIndex {
  generatedAt: string;
  documents: GeneratedDocument[];
  navigation: NavigationItem[];
  stats?: {
    total: number;
    byLifecycle: Record<DocumentLifecycle, number>;
    byVerification: {
      fresh: number;
      stale: number;
      missing: number;
      invalid: number;
    };
    byLayer: {
      rawSource: number;
      wiki: number;
      schema: number;
    };
    byModule: Record<string, number>;
    byFeature: Record<string, number>;
    byDocType: Record<string, number>;
  };
}
