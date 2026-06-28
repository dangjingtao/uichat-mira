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
  };
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
    byLayer: {
      rawSource: number;
      wiki: number;
      schema: number;
    };
    byModule: Record<string, number>;
    byFeature: Record<string, number>;
    byDocType: {
      currentContract: number;
      reference: number;
      overview: number;
      design: number;
      plan: number;
    };
  };
}
