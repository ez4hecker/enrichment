import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

export type UserCredential = {
  id: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
};

export type UserCredentialStore = {
  createUser(input: UserCredential): Promise<UserCredential | undefined>;
  findUserByEmail(email: string): Promise<UserCredential | undefined>;
  createSession(input: {
    id: string;
    ownerId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findOwnerIdByActiveSessionTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<string | undefined>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
};

export type UserAuthentication = {
  register(input: Credentials): Promise<AuthenticationResult>;
  login(input: Credentials): Promise<AuthenticationResult>;
  ownerIdForSession(sessionToken: string | undefined): Promise<string | undefined>;
  logout(sessionToken: string | undefined): Promise<void>;
};

export type Credentials = {
  email: string;
  password: string;
};

export type AuthenticationResult =
  | {
    status: "Authenticated";
    ownerId: string;
    sessionToken: string;
    expiresAt: Date;
  }
  | {
    status: "Rejected";
    code: "INVALID_CREDENTIALS" | "EMAIL_ALREADY_REGISTERED" | "WEAK_PASSWORD";
  };

export type UserAuthenticationOptions = {
  credentialStore: UserCredentialStore;
  sessionDurationMilliseconds?: number;
};

const defaultSessionDurationMilliseconds = 30 * 24 * 60 * 60 * 1_000;

/**
 * Owns password hashing and opaque browser-session handling. Callers only
 * receive an Owner identity after successful registration or login.
 */
export function createUserAuthentication(
  options: UserAuthenticationOptions,
): UserAuthentication {
  const sessionDurationMilliseconds =
    options.sessionDurationMilliseconds ?? defaultSessionDurationMilliseconds;

  if (
    !Number.isInteger(sessionDurationMilliseconds) ||
    sessionDurationMilliseconds <= 0
  ) {
    throw new Error("Session duration must be a positive integer");
  }

  return {
    async register(input) {
      const email = normalizeEmail(input.email);

      if (email === undefined || !isAcceptablePassword(input.password)) {
        return { status: "Rejected", code: "WEAK_PASSWORD" };
      }

      const passwordSalt = randomBytes(16).toString("base64url");
      const passwordHash = await hashPassword(input.password, passwordSalt);
      const user = await options.credentialStore.createUser({
        id: randomUUID(),
        email,
        passwordSalt,
        passwordHash,
      });

      if (user === undefined) {
        return { status: "Rejected", code: "EMAIL_ALREADY_REGISTERED" };
      }

      return createAuthenticatedSession(
        options.credentialStore,
        user.id,
        sessionDurationMilliseconds,
      );
    },
    async login(input) {
      const email = normalizeEmail(input.email);

      if (email === undefined) {
        return { status: "Rejected", code: "INVALID_CREDENTIALS" };
      }

      const user = await options.credentialStore.findUserByEmail(email);

      if (
        user === undefined ||
        !(await passwordMatches(input.password, user.passwordSalt, user.passwordHash))
      ) {
        return { status: "Rejected", code: "INVALID_CREDENTIALS" };
      }

      return createAuthenticatedSession(
        options.credentialStore,
        user.id,
        sessionDurationMilliseconds,
      );
    },
    async ownerIdForSession(sessionToken) {
      return sessionToken === undefined
        ? undefined
        : options.credentialStore.findOwnerIdByActiveSessionTokenHash(
          hashSessionToken(sessionToken),
          new Date(),
        );
    },
    async logout(sessionToken) {
      if (sessionToken !== undefined) {
        await options.credentialStore.revokeSessionByTokenHash(
          hashSessionToken(sessionToken),
        );
      }
    },
  };
}

async function createAuthenticatedSession(
  credentialStore: UserCredentialStore,
  ownerId: string,
  sessionDurationMilliseconds: number,
): Promise<AuthenticationResult> {
  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDurationMilliseconds);

  await credentialStore.createSession({
    id: randomUUID(),
    ownerId,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  return { status: "Authenticated", ownerId, sessionToken, expiresAt };
}

function normalizeEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();

  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : undefined;
}

function isAcceptablePassword(password: string): boolean {
  return password.length >= 12 && password.length <= 1_024;
}

async function passwordMatches(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const actualHash = await hashPassword(password, salt);
  const actual = Buffer.from(actualHash, "base64");
  const expected = Buffer.from(expectedHash, "base64");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error !== null) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });

  return key.toString("base64");
}

function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}
