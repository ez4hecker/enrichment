import type { Pool } from "pg";

import type {
  CompanyDossierStore,
  DossierMaterial,
} from "../research/company-dossier.js";

export function createPostgresCompanyDossierStore(options: {
  pool: Pick<Pool, "query">;
}): CompanyDossierStore {
  return {
    async readMany(domains) {
      const found = new Map<string, Array<DossierMaterial>>();

      if (domains.length === 0) {
        return found;
      }

      const result = await options.pool.query<{ domain: string; material: Array<DossierMaterial> }>(
        `SELECT domain, material
         FROM company_dossiers
         WHERE domain = ANY($1::text[])
           AND expires_at > CURRENT_TIMESTAMP`,
        [domains],
      );

      for (const row of result.rows) {
        found.set(row.domain, Array.isArray(row.material) ? row.material : []);
      }

      return found;
    },
    async write(domain, material, expiresAt) {
      await options.pool.query(
        `INSERT INTO company_dossiers (domain, material, updated_at, expires_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP, $3)
         ON CONFLICT (domain) DO UPDATE
         SET material = EXCLUDED.material,
             updated_at = EXCLUDED.updated_at,
             expires_at = EXCLUDED.expires_at`,
        [domain, JSON.stringify(material), expiresAt],
      );
    },
    async deleteExpired(now) {
      const result = await options.pool.query(
        "DELETE FROM company_dossiers WHERE expires_at <= $1",
        [now],
      );

      return result.rowCount ?? 0;
    },
  };
}
