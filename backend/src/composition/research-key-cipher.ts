import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export type ResearchKeyCipher = {
  encrypt(apiKey: string): string;
  decrypt(encrypted: string): string;
  /** Same key, same fingerprint: lets the store refuse a key twice without decrypting every row. */
  fingerprint(apiKey: string): string;
};

/**
 * Contributed API keys are stored with AES-256-GCM under a server secret that never reaches
 * the database, so a database dump alone does not reveal them.
 */
export function createResearchKeyCipher(secret: string): ResearchKeyCipher {
  if (secret.length < 32) {
    throw new Error("RESEARCH_KEY_ENCRYPTION_SECRET must be at least 32 characters");
  }

  const encryptionKey = createHash("sha256").update(`encryption:${secret}`).digest();
  const fingerprintKey = createHash("sha256").update(`fingerprint:${secret}`).digest();

  return {
    encrypt(apiKey) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
      const ciphertext = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);

      return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
    },
    decrypt(encrypted) {
      const [version, iv, tag, ciphertext] = encrypted.split(":");

      if (version !== "v1" || iv === undefined || tag === undefined || ciphertext === undefined) {
        throw new Error("Encrypted research key has an unknown format");
      }

      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));

      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
    fingerprint(apiKey) {
      return createHmac("sha256", fingerprintKey).update(apiKey).digest("hex");
    },
  };
}
