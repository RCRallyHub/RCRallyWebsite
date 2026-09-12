// Serves a portal-uploaded image straight out of Turso's `media` table.
// Cache-Control is long-lived and immutable because a media row's bytes
// never change after creation (see src/lib/storage.ts) — a "replace"
// always creates a new row/id instead of overwriting one.
import type { APIRoute } from 'astro';
import { getImage } from '../../lib/storage';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return new Response('Not found', { status: 404 });
  }

  const image = await getImage(id);
  if (!image) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(image.data, {
    status: 200,
    headers: {
      'Content-Type': image.mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
