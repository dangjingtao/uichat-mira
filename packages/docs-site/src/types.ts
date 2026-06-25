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
}
