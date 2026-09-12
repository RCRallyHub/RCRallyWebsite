import { getDb } from '../db';
import { cached } from './cache';

export interface TestimonialData {
  customerName: string;
  customerType: string;
  avatar?: string;
  rating: number;
  testimonial: string;
  displayOrder: number;
  featured: boolean;
  published: boolean;
}

export interface TestimonialEntry {
  id: string;
  data: TestimonialData;
}

async function fetchTestimonials(): Promise<TestimonialEntry[]> {
  const db = getDb();
  const rows = (await db.execute('SELECT * FROM testimonials')).rows;
  return rows.map((r) => ({
    id: String(r.slug),
    data: {
      customerName: String(r.customer_name),
      customerType: String(r.customer_type),
      avatar: r.avatar_url ? String(r.avatar_url) : undefined,
      rating: Number(r.rating),
      testimonial: String(r.testimonial),
      displayOrder: Number(r.display_order),
      featured: !!r.featured,
      published: !!r.published,
    },
  }));
}

export function getTestimonials(): Promise<TestimonialEntry[]> {
  return cached('testimonials', fetchTestimonials);
}
