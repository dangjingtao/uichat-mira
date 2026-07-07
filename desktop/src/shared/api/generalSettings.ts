import { get, put } from "@/shared/lib/request";

export interface GeneralSettings {
  socks5Host: string;
  socks5Port: number;
  socks5Username: string;
  socks5Password: string;
}

export function getGeneralSettings() {
  return get<GeneralSettings>("/general-settings");
}

export function updateGeneralSettings(payload: GeneralSettings) {
  return put<GeneralSettings>("/general-settings", payload);
}
