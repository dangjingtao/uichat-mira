import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { providerConnections, providerModels } from "../schema";
import type {
  NewProviderConnection,
  NewProviderModel,
  ProviderCode,
  ProviderConnection,
  ProviderModel,
  ProviderStatus,
} from "../schema";

export const providerConnectionRepository = {
  findAll(): ProviderConnection[] {
    const db = getDb();
    return db.select().from(providerConnections).all();
  },

  findByCode(providerCode: ProviderCode): ProviderConnection | undefined {
    const db = getDb();
    return db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.providerCode, providerCode))
      .limit(1)
      .get();
  },

  upsert(
    data: Omit<NewProviderConnection, "createdAt" | "updatedAt">,
  ): ProviderConnection {
    const db = getDb();
    const existing = this.findByCode(data.providerCode);

    if (existing) {
      return db
        .update(providerConnections)
        .set({
          displayName: data.displayName,
          baseUrl: data.baseUrl,
          apiKeyEncrypted: data.apiKeyEncrypted ?? null,
          isEnabled: data.isEnabled ?? true,
          status: data.status ?? existing.status,
          lastError: data.lastError ?? null,
          lastSyncedAt: data.lastSyncedAt ?? existing.lastSyncedAt,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(providerConnections.providerCode, data.providerCode))
        .returning()
        .get();
    }

    return db
      .insert(providerConnections)
      .values({
        ...data,
        isEnabled: data.isEnabled ?? true,
      })
      .returning()
      .get();
  },

  updateStatus(
    providerCode: ProviderCode,
    status: ProviderStatus,
    lastError: string | null,
    lastSyncedAt?: string | null,
  ): ProviderConnection | undefined {
    const db = getDb();
    return db
      .update(providerConnections)
      .set({
        status,
        lastError,
        lastSyncedAt: lastSyncedAt ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(providerConnections.providerCode, providerCode))
      .returning()
      .get();
  },
};

export const providerModelRepository = {
  findByProvider(providerCode: ProviderCode): ProviderModel[] {
    const db = getDb();
    return db
      .select()
      .from(providerModels)
      .where(and(eq(providerModels.providerCode, providerCode), eq(providerModels.isActive, true)))
      .all();
  },

  replaceForProvider(
    providerCode: ProviderCode,
    models: Array<Omit<NewProviderModel, "id">>,
  ): ProviderModel[] {
    const sqlite = getSqlite();
    const tx = sqlite.transaction(() => {
      const db = getDb();
      db.delete(providerModels).where(eq(providerModels.providerCode, providerCode)).run();

      if (models.length === 0) {
        return [] as ProviderModel[];
      }

      return db.insert(providerModels).values(models).returning().all();
    });

    return tx();
  },

  findByProviderAndRemoteModelId(
    providerCode: ProviderCode,
    remoteModelId: string,
  ): ProviderModel | undefined {
    const db = getDb();
    return db
      .select()
      .from(providerModels)
      .where(
        and(
          eq(providerModels.providerCode, providerCode),
          eq(providerModels.remoteModelId, remoteModelId),
          eq(providerModels.isActive, true),
        ),
      )
      .limit(1)
      .get();
  },
};
