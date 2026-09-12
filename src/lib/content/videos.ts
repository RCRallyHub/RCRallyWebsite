import { getDb } from '../db';
import { cached } from './cache';

export interface VideoData {
  title: string;
  description?: string;
  facebookReelUrl: string;
  approvedEmbedUrl: string;
  posterImage: string;
  posterImageAlt?: string;
  category: string;
  date?: string;
  displayOrder: number;
  featured: boolean;
  published: boolean;
}

export interface VideoEntry {
  id: string;
  data: VideoData;
}

async function fetchVideos(): Promise<VideoEntry[]> {
  const db = getDb();
  const rows = (await db.execute('SELECT * FROM videos')).rows;
  return rows.map((r) => ({
    id: String(r.slug),
    data: {
      title: String(r.title),
      description: r.description ? String(r.description) : undefined,
      facebookReelUrl: String(r.facebook_reel_url),
      approvedEmbedUrl: String(r.approved_embed_url),
      posterImage: String(r.poster_image_url),
      posterImageAlt: r.poster_image_alt ? String(r.poster_image_alt) : undefined,
      category: String(r.category),
      date: r.video_date ? String(r.video_date) : undefined,
      displayOrder: Number(r.display_order),
      featured: !!r.featured,
      published: !!r.published,
    },
  }));
}

export function getVideos(): Promise<VideoEntry[]> {
  return cached('videos', fetchVideos);
}
