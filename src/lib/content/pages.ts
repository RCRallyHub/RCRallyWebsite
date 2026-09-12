import { getDb } from '../db';
import { cached } from './cache';

export interface PageCta {
  label: string;
  href: string;
  style: 'primary' | 'secondary' | 'ghost';
}

export interface PageData {
  title: string;
  heading: string;
  subheading?: string;
  description?: string;
  heroImage?: string;
  heroImageAlt?: string;
  ctas?: PageCta[];
  published: boolean;
  seoTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

export interface PageEntry {
  slug: string;
  data: PageData;
  body: string;
}

async function fetchPageBySlug(slug: string): Promise<PageEntry | undefined> {
  const db = getDb();
  const row = (await db.execute({ sql: 'SELECT * FROM pages WHERE slug = ?', args: [slug] })).rows[0];
  if (!row) return undefined;

  const ctaRows = (
    await db.execute({
      sql: 'SELECT label, href, style FROM page_ctas WHERE page_id = ? ORDER BY sort_order',
      args: [row.id],
    })
  ).rows;

  return {
    slug: String(row.slug),
    body: row.body ? String(row.body) : '',
    data: {
      title: String(row.title),
      heading: String(row.heading),
      subheading: row.subheading ? String(row.subheading) : undefined,
      description: row.description ? String(row.description) : undefined,
      heroImage: row.hero_image_url ? String(row.hero_image_url) : undefined,
      heroImageAlt: row.hero_image_alt ? String(row.hero_image_alt) : undefined,
      ctas: ctaRows.length
        ? ctaRows.map((c) => ({ label: String(c.label), href: String(c.href), style: c.style as PageCta['style'] }))
        : undefined,
      published: !!row.published,
      seoTitle: row.seo_title ? String(row.seo_title) : undefined,
      metaDescription: row.meta_description ? String(row.meta_description) : undefined,
      ogImage: row.og_image_url ? String(row.og_image_url) : undefined,
    },
  };
}

export function getPageBySlug(slug: string): Promise<PageEntry | undefined> {
  return cached(`page:${slug}`, () => fetchPageBySlug(slug));
}
