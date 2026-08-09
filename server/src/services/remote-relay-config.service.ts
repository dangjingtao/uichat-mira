import CONFIG from "@/config/index.js";
import {
  remoteRelaySettingsRepository,
  type RemoteRelayEndpointMode,
} from "@/db/repositories/remote-relay-settings.repository.js";
import type { RemoteRelayConnectorConfig } from "@/services/remote-relay-connector.service.js";

export type RemoteRelayUserConfig = {
  enabled: boolean;
  endpointMode: RemoteRelayEndpointMode;
  customUrl: string;
  effectiveUrl: string | null;
  defaultAvailable: boolean;
  updatedAt: string | null;
};

export class RemoteRelayConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteRelayConfigError";
  }
}

const normalizeBaseUrl = (
  value: string | null | undefined,
  nodeEnv = process.env.NODE_ENV,
) => {
  const normalized = value?.trim() ?? "";
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== "/" && url.pathname !== "") return null;

    const allowHttp = nodeEnv !== "production";
    if (url.protocol !== "https:" && !(allowHttp && url.protocol === "http:")) {
      return null;
    }

    url.pathname = "/";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
};

const toWebSocketUrl = (value: string | null) => {
  if (!value) return null;
  const url = new URL(value);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/u, "");
};

const getDefaultRelayUrl = () => normalizeBaseUrl(CONFIG.REMOTE_RELAY_DEFAULT_URL);

const resolveEffectiveUrl = (input: {
  endpointMode: RemoteRelayEndpointMode;
  customUrl: string;
}) =>
  input.endpointMode === "custom"
    ? normalizeBaseUrl(input.customUrl)
    : getDefaultRelayUrl();

export const getRemoteRelayUserConfig = (): RemoteRelayUserConfig => {
  const settings = remoteRelaySettingsRepository.get();
  return {
    enabled: settings.enabled,
    endpointMode: settings.endpointMode,
    customUrl: settings.customUrl,
    effectiveUrl: resolveEffectiveUrl(settings),
    defaultAvailable: Boolean(getDefaultRelayUrl()),
    updatedAt: settings.updatedAt,
  };
};

export const resolvePersistedRemoteRelayConnectorConfig =
  (): RemoteRelayConnectorConfig => {
    const settings = remoteRelaySettingsRepository.get();
    return {
      enabled: settings.enabled,
      relayUrl: toWebSocketUrl(resolveEffectiveUrl(settings)),
      relayId: settings.relayId,
      hostToken: settings.hostToken,
      clientToken: settings.clientToken,
    };
  };

export const updateRemoteRelayUserConfig = (input: {
  enabled?: boolean;
  endpointMode?: RemoteRelayEndpointMode;
  customUrl?: string;
}): RemoteRelayUserConfig => {
  const current = remoteRelaySettingsRepository.get();
  const endpointMode = input.endpointMode ?? current.endpointMode;
  const customUrl =
    typeof input.customUrl === "string" ? input.customUrl.trim() : current.customUrl;
  const enabled = typeof input.enabled === "boolean" ? input.enabled : current.enabled;

  if (customUrl && !normalizeBaseUrl(customUrl)) {
    throw new RemoteRelayConfigError(
      "Custom Mira Relay address must be a valid HTTPS base URL",
    );
  }

  const effectiveUrl = resolveEffectiveUrl({ endpointMode, customUrl });
  if (enabled && !effectiveUrl) {
    throw new RemoteRelayConfigError(
      endpointMode === "custom"
        ? "Enter a valid custom Mira Relay address before enabling Relay"
        : "The default Mira Relay service is not configured in this build",
    );
  }

  remoteRelaySettingsRepository.update({ enabled, endpointMode, customUrl });
  return getRemoteRelayUserConfig();
};

export const getRemoteRelayPairingMetadata = () => {
  const settings = remoteRelaySettingsRepository.get();
  const endpoint = resolveEffectiveUrl(settings);
  return settings.enabled && endpoint
    ? {
        endpoint,
        relayId: settings.relayId,
      }
    : null;
};
