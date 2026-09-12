// Portal-uploaded image storage — BLOBs in Turso's `media` table (Phase 1
// schema), per the user's explicit direction to store new/replaced images
// directly in the database rather than an external object store. Existing
// static files under public/images/* are untouched and never migrated in
// here; this is only for images uploaded through /portal from now on.
//
// A media row's bytes never change after creation — "replacing" an image
// always inserts a new row/id and the referencing column is updated to
// point at the new id — which is what makes the long-lived immutable
// Cache-Control on /media/[id] safe (see src/pages/media/[id].ts).
import { getDb } from './db';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB — generous for web-sized photos, cheap to raise later
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);

export interface StoredImage {
  data: ArrayBuffer;
  mimeType: string;
  updatedAt: number;
}

export interface SaveImageInput {
  file: File;
  altText?: string | null;
  caption?: string | null;
  title?: string | null;
}

/** Validates and stores an uploaded File as a new `media` row. Returns its id. */
export async function saveImage(input: SaveImageInput): Promise<number> {
  const { file } = input;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type "${file.type || 'unknown'}" — use JPEG, PNG, WebP, GIF, or SVG.`);
  }
  if (file.size === 0) {
    throw new Error('Uploaded file is empty.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is too large (${Math.round(file.size / 1024 / 1024)}MB) — the limit is 8MB.`);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const db = getDb();
  const result = await db.execute({
    sql: `INSERT INTO media (data, mime_type, size_bytes, alt_text, caption, title)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [buffer, file.type, file.size, input.altText ?? null, input.caption ?? null, input.title ?? null],
  });
  return Number(result.lastInsertRowid);
}

/** Reads back a stored image's bytes + mime type for /media/[id] to serve. */
export async function getImage(id: number): Promise<StoredImage | null> {
  const db = getDb();
  const result = await db.execute({ sql: 'SELECT data, mime_type, updated_at FROM media WHERE id = ?', args: [id] });
  const row = result.rows[0];
  if (!row) return null;
  return {
    // @libsql/client returns a BLOB column as a plain ArrayBuffer.
    data: row.data as ArrayBuffer,
    mimeType: String(row.mime_type),
    updatedAt: Number(row.updated_at),
  };
}

export async function deleteImage(id: number): Promise<void> {
  const db = getDb();
  await db.execute({ sql: 'DELETE FROM media WHERE id = ?', args: [id] });
}

export function mediaUrl(id: number): string {
  return `/media/${id}`;
}

/** True for values this module produced — used to tell a stored upload apart from a static /images/* path. */
export function isMediaUrl(value: string | null | undefined): boolean {
  return !!value && /^\/media\/\d+$/.test(value);
}

/**
 * Resolves an image form field that offers both "paste a path/URL" and
 * "upload a file" inputs: if a non-empty file was uploaded under
 * `${fieldKey}_upload`, stores it and returns the new /media/<id> URL;
 * otherwise falls back to the plain text value at `fieldKey` (an existing
 * static path, or a URL the admin typed/kept).
 */
export async function resolveImageField(
  form: FormData,
  fieldKey: string,
  meta?: { altText?: string | null; caption?: string | null; title?: string | null }
): Promise<string | null> {
  const uploaded = form.get(`${fieldKey}_upload`);
  if (uploaded instanceof File && uploaded.size > 0) {
    const id = await saveImage({ file: uploaded, ...meta });
    return mediaUrl(id);
  }
  const raw = form.get(fieldKey);
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s ? s : null;
}
