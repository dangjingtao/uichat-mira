import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SECRET_SOURCE =
  process.env.SETTINGS_SECRET ||
  process.env.JWT_SECRET ||
  "uichat-rag-test-secret-key-change-in-production";

const SECRET_KEY = createHash("sha256").update(SECRET_SOURCE).digest();

export const encryptSecret = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", SECRET_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
};

export const decryptSecret = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  const [ivPart, tagPart, encryptedPart] = value.split(".");
  if (!ivPart || !tagPart || !encryptedPart) {
    return value;
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    SECRET_KEY,
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};
