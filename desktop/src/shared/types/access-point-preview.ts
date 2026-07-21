export type AccessPointPreview = {
  name: string;
  resourceType: "document" | "table" | "collection";
  source: string;
  permissions: string[];
  metadata: Record<string, string>;
  fields?: Array<{ name: string; type: string }>;
  samples?: Array<Record<string, unknown>>;
  excerpt?: string;
  openUrl?: string;
};
