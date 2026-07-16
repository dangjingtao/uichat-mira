import { getSqlite } from "../index";

export type NewsItemEmbedding = {
  newsItemId: string;
  embedding: number[];
  model: string;
  modelConfigId: string;
};

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS news_item_embeddings (
      news_item_id TEXT PRIMARY KEY NOT NULL,
      embedding_json TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT '',
      model_config_id TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
};

export const newsItemsVectorRepository = {
  initialize() {
    ensureTable();
  },

  upsertMany(items: NewsItemEmbedding[]) {
    const statement = getSqlite().prepare(`
      INSERT INTO news_item_embeddings
        (news_item_id, embedding_json, model, model_config_id, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(news_item_id) DO UPDATE SET
        embedding_json = excluded.embedding_json,
        model = excluded.model,
        model_config_id = excluded.model_config_id,
        updated_at = excluded.updated_at
    `);
    const transaction = getSqlite().transaction((values: NewsItemEmbedding[]) => {
      for (const item of values) {
        statement.run(
          item.newsItemId,
          JSON.stringify(item.embedding),
          item.model,
          item.modelConfigId,
        );
      }
    });
    transaction(items);
  },

  listAll(filter?: { model?: string; modelConfigId?: string }): NewsItemEmbedding[] {
    const predicates: string[] = [];
    const params: string[] = [];
    if (filter?.model !== undefined) {
      predicates.push("model = ?");
      params.push(filter.model);
    }
    if (filter?.modelConfigId !== undefined) {
      predicates.push("model_config_id = ?");
      params.push(filter.modelConfigId);
    }
    const where = predicates.length > 0 ? ` WHERE ${predicates.join(" AND ")}` : "";
    return getSqlite()
      .prepare(
        `SELECT news_item_id, embedding_json, model, model_config_id FROM news_item_embeddings${where}`,
      )
      .all(...params)
      .flatMap((row) => {
        const value = row as {
          news_item_id: string;
          embedding_json: string;
          model: string;
          model_config_id: string;
        };
        try {
          const embedding = JSON.parse(value.embedding_json) as unknown;
          return Array.isArray(embedding) && embedding.every((item) => typeof item === "number")
            ? [{ newsItemId: value.news_item_id, embedding, model: value.model, modelConfigId: value.model_config_id }]
            : [];
        } catch {
          return [];
        }
      });
  },
};
