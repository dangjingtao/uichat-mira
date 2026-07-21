import { and, eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index";
import { providerConnections, providerModels } from "../schema";
import { nowIso } from "@/utils/time.js";
import type {
  NewProviderConnection,
  NewProviderModel,
  ProviderCode,
  ProviderConnection,
  ProviderModel,
  ProviderStatus,
  ProviderTemplateCode,
} from "../schema";

export const providerConnectionRepository = {
  findAll(): ProviderConnection[] {
    const db = getDb();
    return db.select().from(providerConnections).all();
  },

  findById(id: string): ProviderConnection | undefined {
    const db = getDb();
    return db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.id, id))
      .limit(1)
      .get();
  },

  findByCode(providerCode: ProviderCode): ProviderConnection | undefined {
    const legacySystemConnection = this.findById(providerCode);
    if (legacySystemConnection?.providerCode === providerCode) {
      return legacySystemConnection;
    }

    const db = getDb();
    return db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.providerCode, providerCode))
      .limit(1)
      .get();
  },

  findByTemplateCode(templateCode: ProviderTemplateCode): ProviderConnection[] {
    const db = getDb();
    return db
      .select()
      .from(providerConnections)
      .where(eq(providerConnections.templateCode, templateCode))
      .all();
  },

  create(
    data: Omit<NewProviderConnection, "createdAt" | "updatedAt">,
  ): ProviderConnection {
    const db = getDb();
    return db
      .insert(providerConnections)
      .values({
        ...data,
        isEnabled: data.isEnabled ?? true,
        isSystem: data.isSystem ?? false,
      })
      .returning()
      .get();
  },

  update(
    id: string,
    data: Partial<
      Omit<NewProviderConnection, "id" | "createdAt" | "updatedAt">
    >,
  ): ProviderConnection | undefined {
    const db = getDb();
    return db
      .update(providerConnections)
      .set({
        ...data,
        updatedAt: nowIso(),
      })
      .where(eq(providerConnections.id, id))
      .returning()
      .get();
  },

  upsertSystemConnection(
    data: Omit<NewProviderConnection, "createdAt" | "updatedAt"> & { id: string },
  ): ProviderConnection {
    const existing =
      this.findById(data.id) ??
      (data.id === data.providerCode ? this.findByCode(data.providerCode!) : undefined);

    if (existing) {
      return (
        this.update(existing.id, {
          templateCode: data.templateCode,
          providerCode: data.providerCode ?? existing.providerCode,
          displayName: data.displayName,
          baseUrl: data.baseUrl,
          apiKeyEncrypted: data.apiKeyEncrypted ?? existing.apiKeyEncrypted,
          isSystem: data.isSystem ?? true,
          isEnabled: data.isEnabled ?? existing.isEnabled,
          status: data.status ?? existing.status,
          lastError: data.lastError ?? existing.lastError,
          lastSyncedAt: data.lastSyncedAt ?? existing.lastSyncedAt,
        }) ?? existing
      );
    }

    return this.create({
      ...data,
      isSystem: data.isSystem ?? true,
    });
  },

  updateStatus(
    id: string,
    status: ProviderStatus,
    lastError: string | null,
    lastSyncedAt?: string | null,
  ): ProviderConnection | undefined {
    return this.update(id, {
      status,
      lastError,
      lastSyncedAt: lastSyncedAt ?? null,
    });
  },

  delete(id: string): void {
    const db = getDb();
    db.delete(providerConnections).where(eq(providerConnections.id, id)).run();
  },
};

export const providerModelRepository = {
  findByConnectionId(providerConnectionId: string): ProviderModel[] {
    const db = getDb();
    return db
      .select()
      .from(providerModels)
      .where(
        and(
          eq(providerModels.providerConnectionId, providerConnectionId),
          eq(providerModels.isActive, true),
        ),
      )
      .all();
  },

  findByProvider(providerCode: ProviderCode): ProviderModel[] {
    const db = getDb();
    return db
      .select()
      .from(providerModels)
      .where(and(eq(providerModels.providerCode, providerCode), eq(providerModels.isActive, true)))
      .all();
  },

  replaceForConnection(
    providerConnectionId: string,
    models: Array<Omit<NewProviderModel, "id">>,
  ): ProviderModel[] {
    const sqlite = getSqlite();
    const tx = sqlite.transaction(() => {
      const db = getDb();
      db.delete(providerModels)
        .where(eq(providerModels.providerConnectionId, providerConnectionId))
        .run();

      if (models.length === 0) {
        return [] as ProviderModel[];
      }

      return db.insert(providerModels).values(models).returning().all();
    });

    return tx();
  },

  replaceForProvider(
    providerCode: ProviderCode,
    models: Array<Omit<NewProviderModel, "id">>,
  ): ProviderModel[] {
    const connection = providerConnectionRepository.findByCode(providerCode);
    if (!connection) {
      return [];
    }

    return this.replaceForConnection(
      connection.id,
      models.map((model) => ({
        ...model,
        providerConnectionId: connection.id,
        providerCode,
      })),
    );
  },

  findByConnectionAndRemoteModelId(
    providerConnectionId: string,
    remoteModelId: string,
  ): ProviderModel | undefined {
    const db = getDb();
    return db
      .select()
      .from(providerModels)
      .where(
        and(
          eq(providerModels.providerConnectionId, providerConnectionId),
          eq(providerModels.remoteModelId, remoteModelId),
          eq(providerModels.isActive, true),
        ),
      )
      .limit(1)
      .get();
  },

  findByProviderAndRemoteModelId(
    providerCode: ProviderCode,
    remoteModelId: string,
  ): ProviderModel | undefined {
    const connection = providerConnectionRepository.findByCode(providerCode);
    if (!connection) {
      return undefined;
    }

    return this.findByConnectionAndRemoteModelId(connection.id, remoteModelId);
  },
};
