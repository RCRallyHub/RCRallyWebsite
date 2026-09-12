import { getDb } from '../db';
import { cached } from './cache';

export interface FaqData {
  question: string;
  answer: string;
  category: string;
  displayOrder: number;
  published: boolean;
  useAsChatbotAnswer: boolean;
}

export interface FaqEntry {
  id: string;
  data: FaqData;
}

async function fetchFaqs(): Promise<FaqEntry[]> {
  const db = getDb();
  // ORDER BY slug matches the original file-based collection's implicit
  // order (files were named 01-..., 02-..., ...): ChatbotWidget.astro reads
  // this list without its own sort, so DB row order must be deterministic
  // and match what the old numbered filenames produced.
  const rows = (await db.execute('SELECT * FROM faqs ORDER BY slug')).rows;
  return rows.map((r) => ({
    id: String(r.slug),
    data: {
      question: String(r.question),
      answer: String(r.answer),
      category: String(r.category),
      displayOrder: Number(r.display_order),
      published: !!r.published,
      useAsChatbotAnswer: !!r.use_as_chatbot_answer,
    },
  }));
}

export function getFaqs(): Promise<FaqEntry[]> {
  return cached('faqs', fetchFaqs);
}
