import { getSqlite } from "../index";

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS tts_ref_audio_bindings (
      provider_id TEXT NOT NULL,
      client_ref_audio_id TEXT NOT NULL,
      server_ref_audio_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (provider_id, client_ref_audio_id)
    );
    CREATE INDEX IF NOT EXISTS idx_tts_ref_audio_bindings_server_id
      ON tts_ref_audio_bindings(server_ref_audio_id);
  `);
};

export const ttsRefAudioBindingsRepository = {
  initialize() {
    ensureTable();
  },

  get(providerId: string, clientRefAudioId: string) {
    ensureTable();
    return getSqlite().prepare(`
      SELECT provider_id AS providerId,
             client_ref_audio_id AS clientRefAudioId,
             server_ref_audio_id AS serverRefAudioId
      FROM tts_ref_audio_bindings
      WHERE provider_id = ? AND client_ref_audio_id = ?
    `).get(providerId, clientRefAudioId) as {
      providerId: string;
      clientRefAudioId: string;
      serverRefAudioId: string;
    } | undefined ?? null;
  },

  upsert(providerId: string, clientRefAudioId: string, serverRefAudioId: string) {
    ensureTable();
    const sqlite = getSqlite();
    sqlite.prepare(`
      INSERT INTO tts_ref_audio_bindings
        (provider_id, client_ref_audio_id, server_ref_audio_id, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(provider_id, client_ref_audio_id) DO UPDATE SET
        server_ref_audio_id = excluded.server_ref_audio_id,
        updated_at = datetime('now')
    `).run(providerId, clientRefAudioId, serverRefAudioId);
    return { providerId, clientRefAudioId, serverRefAudioId };
  },
};
