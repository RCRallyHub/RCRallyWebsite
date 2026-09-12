#!/usr/bin/env node
/**
 * One-time (re-runnable) sync: copies the full contents of the local dev
 * database (db/local.db by default) into a real, empty Turso/libSQL
 * database, so a production deploy starts with all the real content that
 * has been built up through the portal -- not just whatever
 * migrate-to-turso.mjs originally seeded (that script's own source,
 * src/content/*, no longer exists -- see its own header comment).
 *
 * Usage:
 *   TURSO_DATABASE_URL=libsql://your-db-name.turso.io \
 *   TURSO_AUTH_TOKEN=your-token \
 *   node scripts/sync-local-to-turso.mjs
 *
 * Optional env vars:
 *   LOCAL_DB_PATH   -- source database URL (default: file:./db/local.db)
 *   SYNC_RESET=1    -- delete all rows from every target table (in reverse
 *                      schema order) before copying, so the script can be
 *                      safely re-run after fixing something on the source
 *                      side, instead of only ever running once against an
 *                      empty database.
 *
 * Safe by design:
 *   - Never opens db/local.db for writing -- it only ever SELECTs from the
 *     source and INSERTs into the destination.
 *   - Refuses to run if TURSO_DATABASE_URL is missing or looks like a local
 *     file (this script's whole point is copying INTO a remote database;
 *     running it with a `file:` destination by accident would just clone
 *     the local db onto itself).
 *   - Applies db/schema.sql to the destination first (CREATE TABLE IF NOT
 *     EXISTS, so it's a no-op against an already-provisioned database).
 *   - Uses `INSERT OR REPLACE`, keyed on each table's real primary key, so
 *     re-running it after a partial run or after SYNC_RESET never
 *     duplicates rows.
 *   - Table order is read straight out of db/schema.sql's own CREATE TABLE
 *     order, which is already parent-before-child (e.g. `pages` before
 *     `page_ctas`); foreign key enforcement is switched off for the
 *     duration of the copy regardless, as a second safety net.
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const destUrl = process.env.TURSO_DATABASE_URL;
const destToken = process.env.TURSO_AUTH_TOKEN || undefined;
const sourceUrl = process.env.LOCAL_DB_PATH || `file:${path.join(repoRoot, 'db', 'local.db')}`;
const doReset = process.env.SYNC_RESET === '1';

if (!destUrl) {
  console.error('TURSO_DATABASE_URL is required -- point it at your real Turso database.');
  process.exit(1);
}
if (destUrl.startsWith('file:')) {
  console.error('TURSO_DATABASE_URL looks like a local file path. Refusing to run: this script');
  console.error('copies INTO a remote Turso database, and running it against a local file would');
  console.error('just clone the source onto itself (or, on a mismatched path, onto nothing useful).');
  process.exit(1);
}

const schemaSql = readFileSync(path.join(repoRoot, 'db', 'schema.sql'), 'utf-8');
const tableNames = [...schemaSql.matchAll(/^CREATE TABLE IF NOT EXISTS (\w+)/gm)].map((m) => m[1]);
if (tableNames.length === 0) {
  console.error('Could not find any CREATE TABLE statements in db/schema.sql -- aborting.');
  process.exit(1);
}

const source = createClient({ url: sourceUrl });
const dest = createClient({ url: destUrl, authToken: destToken });

function toBlobArg(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return value;
}

async function main() {
  console.log(`Source: ${sourceUrl}`);
  console.log(`Destination: ${destUrl}`);
  console.log(`Tables (in schema order): ${tableNames.join(', ')}`);
  console.log('');

  console.log('Applying db/schema.sql to destination (CREATE TABLE IF NOT EXISTS -- safe no-op if already provisioned)...');
  await dest.executeMultiple(schemaSql);

  await dest.execute('PRAGMA foreign_keys = OFF;');

  if (doReset) {
    console.log('SYNC_RESET=1 -- clearing destination tables first (reverse schema order)...');
    for (const table of [...tableNames].reverse()) {
      await dest.execute(`DELETE FROM ${table}`);
    }
  }

  let totalRows = 0;
  for (const table of tableNames) {
    const { rows, columns } = await source.execute(`SELECT * FROM ${table}`);
    if (rows.length === 0) {
      console.log(`  ${table}: 0 rows`);
      continue;
    }
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;
    for (const row of rows) {
      const args = columns.map((col) => toBlobArg(row[col]));
      await dest.execute({ sql: insertSql, args });
    }
    console.log(`  ${table}: ${rows.length} row(s) copied`);
    totalRows += rows.length;
  }

  await dest.execute('PRAGMA foreign_keys = ON;');

  console.log('');
  console.log(`Done. ${totalRows} total row(s) copied into ${destUrl}.`);
}

main().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
