import { notionDatabase, notionPage, notionQueryDatabase, readNotionPageText, type NotionApiResponse } from "./client.js";

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

type NotionProperty = { type?: string; [key: string]: unknown };

const richText = (value: unknown) => Array.isArray(value)
  ? value.map((item) => typeof item === "object" && item && typeof (item as { plain_text?: unknown }).plain_text === "string" ? (item as { plain_text: string }).plain_text : "").join("")
  : "";

const propertyValue = (property: NotionProperty): unknown => {
  const type = property.type;
  const value = property[type ?? ""];
  if (type === "title" || type === "rich_text") return richText(value);
  if (["number", "checkbox", "url", "email", "phone_number"].includes(type ?? "")) return value ?? null;
  if (type === "select") return typeof value === "object" && value ? (value as { name?: unknown }).name ?? null : null;
  if (type === "multi_select") return Array.isArray(value) ? value.map((item) => typeof item === "object" && item ? String((item as { name?: unknown }).name ?? "") : "").filter(Boolean).join(", ") : "";
  if (type === "date") return typeof value === "object" && value ? String((value as { start?: unknown }).start ?? "") : "";
  if (type === "people") return Array.isArray(value) ? value.map((item) => typeof item === "object" && item ? String((item as { name?: unknown }).name ?? (item as { id?: unknown }).id ?? "") : "").filter(Boolean).join(", ") : "";
  if (type === "relation") return Array.isArray(value) ? `${value.length} 条关联` : "";
  if (type === "rollup") return "Rollup";
  return null;
};

const propertyType = (property: NotionProperty) => property.type || "unknown";
const resourceMetadata = (resource: NotionApiResponse, resourceId: string) => ({
  "资源 ID": resourceId,
  "最后编辑": typeof resource.last_edited_time === "string" ? resource.last_edited_time : "未知",
});

export async function previewNotionResource(token: string, point: { type: string; resourceId: string; resourceTitle: string; resourceUrl: string | null; allowedActions: string[] }): Promise<AccessPointPreview> {
  if (point.type === "database") {
    const database = await notionDatabase(token, point.resourceId);
    const properties = (database.properties ?? {}) as Record<string, NotionProperty>;
    const result = await notionQueryDatabase(token, point.resourceId, { page_size: 5 });
    const records = Array.isArray(result.results) ? result.results as NotionApiResponse[] : [];
    return {
      name: richText(database.title) || point.resourceTitle || point.resourceId,
      resourceType: "table",
      source: "Notion",
      permissions: point.allowedActions,
      metadata: { ...resourceMetadata(database, point.resourceId), "示例记录": String(records.length) },
      fields: Object.entries(properties).map(([name, property]) => ({ name, type: propertyType(property) })),
      samples: records.map((record) => Object.fromEntries(Object.entries((record.properties ?? {}) as Record<string, NotionProperty>).map(([name, property]) => [name, propertyValue(property)]))),
      openUrl: point.resourceUrl ?? (typeof database.url === "string" ? database.url : undefined),
    };
  }

  const page = await notionPage(token, point.resourceId);
  const pageText = await readNotionPageText(token, point.resourceId);
  return {
    name: pageText.title || point.resourceTitle || point.resourceId,
    resourceType: "document",
    source: "Notion",
    permissions: point.allowedActions,
    metadata: resourceMetadata(page, point.resourceId),
    excerpt: pageText.text.trim().slice(0, 1200),
    openUrl: point.resourceUrl ?? (typeof page.url === "string" ? page.url : undefined),
  };
}
