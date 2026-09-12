#!/usr/bin/env node
/**
 * Creates (or resets the password of) a /portal admin login.
 *
 * Usage:
 *   node scripts/create-admin-user.mjs <username> [password]
 *
 * If password is omitted, a random 16-character password is generated and
 * printed once — save it, it isn't recoverable afterwards (only its bcrypt
 * hash is stored). Re-running with the same username updates that user's
 * password rather than creating a duplicate.
 *
 * Runs against the local dev database by default; set
 * TURSO_DATABASE_URL / TURSO_AUTH_TOKEN first to target a real hosted
 * Turso database instead (same as scripts/migrate-to-turso.mjs).
 */

import { createClient } from '@libsql/client';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, '..', 'db');

function getClient() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || url.startsWith('file:')) {
    return createClient({ url: url || `file:${path.join(dbDir, 'local.db')}` });
  }
  if (!authToken) {
    throw new Error('TURSO_DATABASE_URL is set but TURSO_AUTH_TOKEN is missing.');
  }
  return createClient({ url, authToken });
}

function generatePassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

async function main() {
  const [, , username, providedPassword] = process.argv;

  if (!username) {
    console.error('Usage: node scripts/create-admin-user.mjs <username> [password]');
    process.exit(1);
  }

  const password = providedPassword || generatePassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const db = getClient();

  const existing = await db.execute({
    sql: 'SELECT id FROM admin_users WHERE username = ? LIMIT 1',
    args: [username],
  });

  if (existing.rows.length > 0) {
    await db.execute({
      sql: 'UPDATE admin_users SET password_hash = ?, updated_at = unixepoch() WHERE username = ?',
      args: [passwordHash, username],
    });
    console.log(`Updated password for existing admin user "${username}".`);
  } else {
    await db.execute({
      sql: 'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
      args: [username, passwordHash],
    });
    console.log(`Created admin user "${username}".`);
  }

  if (!providedPassword) {
    console.log('');
    console.log(`  Username: ${username}`);
    console.log(`  Password: ${password}`);
    console.log('');
    console.log('This password is not stored anywhere else — save it now.');
  }

  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
