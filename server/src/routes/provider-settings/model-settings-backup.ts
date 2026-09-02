import { DEFAULT_PROVIDER_CONNECTIONS } from "@/services/model-config.defaults.js";
import type { ModelSettingsBackup } from "@/services/provider-settings.service.js";

const builtinProviderCodes = new Map(
  DEFAULT_PROVIDER_CONNECTIONS.map((connection) => [
    connection.id,
    connection.providerCode,
  ] as const),
);

const normalizeNullableString = <T extends string>(value: T | null): T | null => {
  if (value === null) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? (normalized as T) : null;
};

/**
 * Model-settings backup v1 existed before nullable provider/model references were
 * consistently serialized as JSON null. Older or migrated installations can
 * therefore produce empty strings for unassigned/custom references.
 *
 * Keep v1 import backward compatible at the HTTP boundary and emit canonical
 * null values on export so a backup created by Mira can always be re-imported.
 */
export const normalizeModelSettingsBackup = (
  backup: ModelSettingsBackup,
): ModelSettingsBackup => ({
  ...backup,
  connections: backup.connections.map((connection) => {
    const providerCode = normalizeNullableString(connection.providerCode);
    const restoredBuiltinProviderCode =
      providerCode ??
      (connection.templateCode === "openai-compatible-custom"
        ? null
        : (builtinProviderCodes.get(connection.id) ?? null));

    return {
      ...connection,
      providerCode: restoredBuiltinProviderCode,
    };
  }),
  assignments: backup.assignments.map((assignment) => ({
    ...assignment,
    providerConnectionId: normalizeNullableString(
      assignment.providerConnectionId,
    ),
    remoteModelId: normalizeNullableString(assignment.remoteModelId),
  })),
});
