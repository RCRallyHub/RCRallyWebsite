import { getDb } from '../db';
import { cached } from './cache';

export interface PolicyData {
  title: string;
  lastUpdated?: string;
  published: boolean;
}

export interface PolicyEntry {
  slug: string;
  data: PolicyData;
  body: string;
}

async function fetchPolicyBySlug(slug: string): Promise<PolicyEntry | undefined> {
  const db = getDb();
  const row = (await db.execute({ sql: 'SELECT * FROM policies WHERE slug = ?', args: [slug] })).rows[0];
  if (!row) return undefined;
  return {
    slug: String(row.slug),
    body: row.body ? String(row.body) : '',
    data: {
      title: String(row.title),
      lastUpdated: row.last_updated ? String(row.last_updated) : undefined,
      published: !!row.published,
    },
  };
}

export function getPolicyBySlug(slug: string): Promise<PolicyEntry | undefined> {
  return cached(`policy:${slug}`, () => fetchPolicyBySlug(slug));
}
