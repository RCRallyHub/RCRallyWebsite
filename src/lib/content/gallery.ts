import { getDb } from '../db';
import { cached } from './cache';

export interface GalleryImageData {
  image: string;
  thumbnail?: string;
  title: string;
  caption?: string;
  alt: string;
  category: string; // gallery_sections.title, joined in
  date?: string;
  displayOrder: number;
  featured: boolean;
  published: boolean;
}

export interface GalleryImageEntry {
  id: string; // slug
  data: GalleryImageData;
}

async function fetchGalleryImages(): Promise<GalleryImageEntry[]> {
  const db = getDb();
  const rows = (
    await db.execute(
      `SELECT gi.*, gs.title AS section_title
       FROM gallery_images gi
       JOIN gallery_sections gs ON gi.section_id = gs.id`
    )
  ).rows;

  return rows.map((r) => ({
    id: String(r.slug),
    data: {
      image: String(r.image_url),
      thumbnail: r.thumbnail_url ? String(r.thumbnail_url) : undefined,
      title: String(r.title),
      caption: r.caption ? String(r.caption) : undefined,
      alt: String(r.alt),
      category: String(r.section_title),
      date: r.image_date ? String(r.image_date) : undefined,
      displayOrder: Number(r.display_order),
      featured: !!r.featured,
      published: !!r.published,
    },
  }));
}

export function getGalleryImages(): Promise<GalleryImageEntry[]> {
  return cached('gallery', fetchGalleryImages);
}
