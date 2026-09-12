// Session-cookie authentication for the /portal admin area.
//
// Single-admin model for now: admin user rows live in `admin_users`
// (created/reset via scripts/create-admin-user.mjs), sessions are tracked
// in `admin_sessions`. The cookie holds a random opaque token; only its
// SHA-256 hash is ever stored in the database, so a leaked DB row alone
// can't be replayed as a valid session cookie.

import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

export const SESSION_COOKIE_NAME = 'rc_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AdminUser {
  id: number;
  username: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Verifies a plaintext password against admin_users. Returns the user, or null if invalid. */
export async function verifyCredentials(username: string, password: string): Promise<AdminUser | null> {
  const db = getDb();
  const result = await db.execute({
    sql: 'SELECT id, username, password_hash FROM admin_users WHERE username = ? LIMIT 1',
    args: [username],
  });

  const row = result.rows[0];
  if (!row) return null;

  const ok = await bcrypt.compare(password, String(row.password_hash));
  if (!ok) return null;

  return { id: Number(row.id), username: String(row.username) };
}

/** Creates a new session row for the given user. Returns the plaintext token to set as a cookie. */
export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const db = getDb();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.execute({
    sql: 'INSERT INTO admin_sessions (token, user_id, expires_at) VALUES (?, ?, ?)',
    args: [hashToken(token), userId, Math.floor(expiresAt.getTime() / 1000)],
  });

  return { token, expiresAt };
}

/** Validates a session token from a cookie. Returns the associated user, or null if invalid/expired. */
export async function validateSession(token: string | undefined | null): Promise<AdminUser | null> {
  if (!token) return null;
  const db = getDb();
  const nowSec = Math.floor(Date.now() / 1000);

  const result = await db.execute({
    sql: `SELECT admin_users.id AS id, admin_users.username AS username
          FROM admin_sessions
          JOIN admin_users ON admin_users.id = admin_sessions.user_id
          WHERE admin_sessions.token = ? AND admin_sessions.expires_at > ?
          LIMIT 1`,
    args: [hashToken(token), nowSec],
  });

  const row = result.rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: String(row.username) };
}

/** Deletes a session (logout). Safe to call with an already-invalid/missing token. */
export async function deleteSession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const db = getDb();
  await db.execute({
    sql: 'DELETE FROM admin_sessions WHERE token = ?',
    args: [hashToken(token)],
  });
}

/** Opportunistic cleanup of expired sessions. Safe to call anytime; swallows errors. */
export async function pruneExpiredSessions(): Promise<void> {
  try {
    const db = getDb();
    const nowSec = Math.floor(Date.now() / 1000);
    await db.execute({ sql: 'DELETE FROM admin_sessions WHERE expires_at <= ?', args: [nowSec] });
  } catch {
    // best-effort only — never let cleanup break a request
  }
}
