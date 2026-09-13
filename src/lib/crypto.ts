import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for third-party credentials at rest.
 * Key comes from ENCRYPTION_KEY (32 bytes, hex or base64). In development we
 * fall back to a key derived from BETTER_AUTH_SECRET so `npm run dev` just works.
 */
function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
    throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)");
  }
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("Set ENCRYPTION_KEY (or BETTER_AUTH_SECRET) in .env.local");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY is required in production");
  }
  return createHash("sha256").update(`howitsgoing:${secret}`).digest();
}

export function encryptJson(value: unknown): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptJson<T = unknown>(payload: string): T {
  if (!payload) return {} as T;
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Unrecognised secret payload");
  }
  const key = getKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}
