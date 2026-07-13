const SENSITIVE_KEY = /authorization|bearer|token|secret|password|api[-_]?key|header|env/iu;
const SENSITIVE_TEXT = /((?:authorization|bearer|token|secret|password|api[-_]?key)\s*[:=]\s*)([^\s,;]+)/giu;

export const redactExternalMcpValue = (
  value: unknown,
  secrets: string[] = [],
): unknown => {
  if (typeof value === "string") {
    return secrets
      .filter(Boolean)
      .reduce((current, secret) => current.split(secret).join("[REDACTED]"), value)
      .replace(SENSITIVE_TEXT, "$1[REDACTED]");
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactExternalMcpValue(item, secrets));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      SENSITIVE_KEY.test(key)
        ? "[REDACTED]"
        : redactExternalMcpValue(child, secrets),
    ]),
  );
};
