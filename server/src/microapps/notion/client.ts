export type NotionApiResponse = Record<string, unknown>;

export async function notionRequest<T extends NotionApiResponse>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : `Notion API request failed (${response.status})`);
  return body;
}

export const notionPage = (token: string, id: string) => notionRequest(token, `/pages/${encodeURIComponent(id)}`);
export const notionDatabase = (token: string, id: string) => notionRequest(token, `/databases/${encodeURIComponent(id)}`);
export const notionQueryDatabase = (token: string, id: string, body: Record<string, unknown>) => notionRequest(token, `/databases/${encodeURIComponent(id)}/query`, { method: "POST", body: JSON.stringify(body) });
export const notionAppendBlocks = (token: string, id: string, children: unknown[]) => notionRequest(token, `/blocks/${encodeURIComponent(id)}/children`, { method: "PATCH", body: JSON.stringify({ children }) });
export const notionCreatePage = (token: string, parent: Record<string, unknown>, properties: Record<string, unknown>, children: unknown[]) => notionRequest(token, "/pages", { method: "POST", body: JSON.stringify({ parent, properties, children }) });

const richText = (value: unknown) => Array.isArray(value) ? value.map((item) => typeof item === "object" && item && typeof (item as { plain_text?: unknown }).plain_text === "string" ? (item as { plain_text: string }).plain_text : "").join("") : "";

export function notionBlockText(block: unknown): string {
  if (!block || typeof block !== "object") return "";
  const value = block as Record<string, unknown>;
  const type = typeof value.type === "string" ? value.type : "";
  const payload = value[type];
  if (!payload || typeof payload !== "object") return "";
  const data = payload as Record<string, unknown>;
  if (type === "child_page") return typeof data.title === "string" ? data.title : "";
  return richText(data.rich_text);
}

export async function readNotionPageText(token: string, pageId: string): Promise<{ title: string; text: string }> {
  const page = await notionPage(token, pageId);
  const properties = (page.properties ?? {}) as Record<string, unknown>;
  const titleProperty = Object.values(properties).find((property) => property && typeof property === "object" && (property as Record<string, unknown>).type === "title") as Record<string, unknown> | undefined;
  const title = titleProperty ? richText((titleProperty.title as unknown)) : String(page.id ?? pageId);
  const children = await notionRequest<{ results?: unknown[] }>(token, `/blocks/${encodeURIComponent(pageId)}/children?page_size=100`);
  const text = (children.results ?? []).map(notionBlockText).filter(Boolean).join("\n\n");
  return { title, text };
}
