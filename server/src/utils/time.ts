export const nowIso = () => new Date().toISOString();

export const nowIsoForFileName = () => nowIso().replace(/[:.]/g, "-");
