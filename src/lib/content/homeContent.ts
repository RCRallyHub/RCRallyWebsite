import { getDb } from '../db';
import { cached } from './cache';

export interface HomeContentData {
  highlights: { icon: string; title: string; description: string }[];
  whyChooseUs: { icon: string; title: string; description: string; isPlaceholder: boolean }[];
  stats: { label: string; value: number; suffix: string; isDummy: boolean }[];
  bookingSteps: { step: number; title: string; description: string }[];
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

async function fetchHomeContent(): Promise<HomeContentData> {
  const db = getDb();

  const highlights = await fetchSectionItems(db, 'home', 'highlights');
  const whyChooseUs = await fetchSectionItems(db, 'home', 'why-choose-us');
  const stats = await fetchSectionItems(db, 'home', 'stats');
  const bookingSteps = await fetchSectionItems(db, 'home', 'booking-steps');

  return {
    highlights: highlights.map((r) => ({
      icon: String(r.icon ?? 'court'),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
    })),
    whyChooseUs: whyChooseUs.map((r) => ({
      icon: String(r.icon ?? 'check'),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
      isPlaceholder: !!r.is_placeholder,
    })),
    stats: stats.map((r) => ({
      label: String(r.title ?? ''),
      value: Number(r.value_number ?? 0),
      suffix: String(r.value_suffix ?? '+'),
      isDummy: !!r.is_placeholder,
    })),
    bookingSteps: bookingSteps.map((r) => ({
      step: Number(r.step_number ?? 0),
      title: String(r.title ?? ''),
      description: String(r.description ?? ''),
    })),
  };
}

export function getHomeContent(): Promise<HomeContentData> {
  return cached('homeContent', fetchHomeContent);
}
