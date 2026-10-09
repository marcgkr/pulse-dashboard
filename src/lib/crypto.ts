// Encryption at rest for connected-account tokens: AES-256-GCM with ENCRYPTION_KEY (32 random bytes, base64).
// Server only. Never log the inputs or outputs of these functions.

import crypto from "node:crypto";

const VERSION = "v1";

export class EncryptionKeyError extends Error {}

/** The 32-byte key, or null when ENCRYPTION_KEY is missing or the wrong length. */
function keyOrNull(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

function key(): Buffer {
  const k = keyOrNull();
  if (!k) {
    throw new EncryptionKeyError(
      "ENCRYPTION_KEY is missing or is not 32 bytes of base64. Connected accounts stay off until it is set (generate one with: openssl rand -base64 32).",
    );
  }
  return k;
}

/** True when tokens can be stored. */
export function encryptionReady(): boolean {
  return keyOrNull() !== null;
}

/** Encrypts a string. Output: v1.<iv>.<tag>.<ciphertext>, each base64url. Throws if the key is missing. */
export function encrypt(plain: string, aad = ""): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Decrypts what encrypt() produced. Throws on a wrong key, tampering or a different aad. */
export function decrypt(sealed: string, aad = ""): string {
  const [v, ivB, tagB, ctB] = String(sealed).split(".");
  if (v !== VERSION || !ivB || !tagB || ctB == null) throw new Error("Not an encrypted value.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}
