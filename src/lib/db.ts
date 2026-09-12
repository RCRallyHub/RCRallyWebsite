// Turso (libSQL) client for RC Rally Hub.
//
// Environment-driven connection, per the approved migration plan:
//   - Local development (default): no TURSO_DATABASE_URL set (or it points at
//     a file: path) -> opens a local libSQL file at db/local.db. No Turso
//     account needed for this.
//   - Production: set TURSO_DATABASE_URL (libsql://...) and TURSO_AUTH_TOKEN
//     in Netlify's environment variables -> connects to the real hosted
//     Turso database. Nothing about the calling code changes either way.
//
// NEVER import this file from client-shipped code — it's server-only. All
// callers are Astro server code (.astro frontmatter under output:'server',
// or src/pages/api/**) or Node scripts (scripts/*.mjs).

import { createClient, type Client } from '@libsql/client';

const DEFAULT_LOCAL_DB_PATH = 'file:./db/local.db';

let client: Client | undefined;

function resolveConfig() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (!url || url.startsWith('file:')) {
    // Local file-based libSQL — no auth token, no network.
    return { url: url || DEFAULT_LOCAL_DB_PATH };
  }

  if (!authToken) {
    throw new Error(
      'TURSO_DATABASE_URL is set to a remote libsql:// URL but TURSO_AUTH_TOKEN is missing. ' +
        'Set both env vars (see .env.example), or unset TURSO_DATABASE_URL to use the local dev database.'
    );
  }

  return { url, authToken };
}

/** Returns the shared libSQL client, creating it on first use. */
export function getDb(): Client {
  if (!client) {
    client = createClient(resolveConfig());
  }
  return client;
}

/** True when this process is pointed at a local file DB rather than hosted Turso. */
export function isLocalDb(): boolean {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  return !url || url.startsWith('file:');
}
