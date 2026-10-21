import type { Pool } from "pg";

import type {
  UserCredential,
  UserCredentialStore,
} from "../user-authentication/user-authentication.js";

type UserCredentialRow = {
  id: string;
  email: string;
  password_salt: string;
  password_hash: string;
};

export type PostgresUserCredentialStoreOptions = {
  pool: Pick<Pool, "query">;
};

export function createPostgresUserCredentialStore(
  options: PostgresUserCredentialStoreOptions,
): UserCredentialStore {
  return {
    async createUser(input) {
      try {
        const result = await options.pool.query<UserCredentialRow>(
          `INSERT INTO app_users (id, email, password_salt, password_hash)
           VALUES ($1, $2, $3, $4)
           RETURNING id, email, password_salt, password_hash`,
          [input.id, input.email, input.passwordSalt, input.passwordHash],
        );

        return result.rows[0] === undefined
          ? undefined
          : toUserCredential(result.rows[0]);
      } catch (error) {
        if (isUniqueConstraintViolation(error)) {
          return undefined;
        }

        throw error;
      }
    },
    async findUserByEmail(email) {
      const result = await options.pool.query<UserCredentialRow>(
        `SELECT id, email, password_salt, password_hash
         FROM app_users
         WHERE email = $1`,
        [email],
      );

      return result.rows[0] === undefined
        ? undefined
        : toUserCredential(result.rows[0]);
    },
    async createSession(input) {
      await options.pool.query(
        `INSERT INTO user_sessions (id, user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [input.id, input.ownerId, input.tokenHash, input.expiresAt],
      );
    },
    async findOwnerIdByActiveSessionTokenHash(tokenHash, now) {
      const result = await options.pool.query<{ user_id: string }>(
        `SELECT user_id
         FROM user_sessions
         WHERE token_hash = $1
           AND revoked_at IS NULL
           AND expires_at > $2`,
        [tokenHash, now],
      );

      return result.rows[0]?.user_id;
    },
    async revokeSessionByTokenHash(tokenHash) {
      await options.pool.query(
        `UPDATE user_sessions
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [tokenHash],
      );
    },
  };
}

function toUserCredential(row: UserCredentialRow): UserCredential {
  return {
    id: row.id,
    email: row.email,
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
  };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505";
}
