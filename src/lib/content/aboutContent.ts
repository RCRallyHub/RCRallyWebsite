import { getDb } from '../db';
import { cached } from './cache';

export interface AboutContentData {
  values: { title: string; description: string }[];
  team: { name: string; role: string; photo?: string; isPlaceholder: boolean }[];
  partners: { name: string; description?: string; logo?: string }[];
}

async function fetchSectionItems(db: ReturnType<typeof getDb>, pageSlug: string, sectionKey: string) {
  const rows = (
    await db.execute({
      sql: `SELECT si.* FROM section_items si
            JOIN page_sections ps ON si.section_id = ps.id
            JOIN pages p ON ps.page_id = p.id
            WHERE p.slug = ? AND ps.section_key = ?
            ORDER BY si.sort_order`,
      args: [pageSlug, sectionKey],
    })
  ).rows;
  return rows;
}

async function fetchAboutContent(): Promise<AboutContentData> {
  const db = getDb();

  const values = await fetchSectionItems(db, 'about', 'values');
  const team = await fetchSectionItems(db, 'about', 'team');
  const partners = await fetchSectionItems(db, 'about', 'partners');

  return {
    values: values.map((r) => ({ title: String(r.title ?? ''), description: String(r.description ?? '') })),
    team: team.map((r) => ({
      name: String(r.name ?? ''),
      role: String(r.role ?? ''),
      photo: r.image_url ? String(r.image_url) : undefined,
      isPlaceholder: !!r.is_placeholder,
    })),
    partners: partners.map((r) => ({
      name: String(r.name ?? ''),
      description: r.description ? String(r.description) : undefined,
      logo: r.image_url ? String(r.image_url) : undefined,
    })),
  };
}

export function getAboutContent(): Promise<AboutContentData> {
  return cached('aboutContent', fetchAboutContent);
}
