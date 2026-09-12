// Generic engine for the "one table, flat list, inline edit" portal screens
// (Testimonials, FAQs, Add-ons, Videos, Policies). Each screen is a thin
// page that defines a SimpleCrudConfig (static, hardcoded per content type —
// NEVER built from request input) and delegates the actual list/add/edit/
// delete/reorder logic here.
//
// SAFETY NOTE: `config.table`, `config.orderColumn`, and every `field.key`
// are interpolated directly into SQL strings below. This is only safe
// because those always come from a config object written by hand in a
// page's frontmatter — never from formData/query params/user input. Every
// *value* going into the database still goes through parameterized `args`.
import type { Client } from '@libsql/client';
import { invalidateCache } from '../content/cache';
import { resolveImageField } from '../storage';

export type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'checkbox' | 'select' | 'tel' | 'email' | 'image';

export interface FieldConfig {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  wide?: boolean;
  options?: string[];
  placeholder?: string;
  defaultValue?: string | number | boolean;
  min?: number;
  max?: number;
}

export interface SimpleCrudConfig {
  table: string;
  /** Column used for reordering. Omit if this content type has no natural order. */
  orderColumn?: string;
  /** Column that marks visibility on the public site (drives the "hidden" list styling). */
  visibilityColumn?: string;
  /** Field shown as the thumbnail preview in each list row, if any. */
  previewField?: string;
  hasSlug: boolean;
  /** Field to derive a new row's slug from (defaults to the first field). */
  slugSourceField?: string;
  fields: FieldConfig[];
  /**
   * Cache key to invalidate after a write. Use the sentinel '__ALL__' for
   * content types cached per-row under a key this engine can't derive
   * (e.g. policies, cached as `policy:${slug}`) — clears the whole cache,
   * which is harmless for a low-frequency admin write.
   */
  cacheKey: string;
  pageTitle: string;
  addLabel: string;
  allowAdd?: boolean;
  allowDelete?: boolean;
}

function slugify(input: string): string {
  return input.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

async function uniqueSlug(db: Client, table: string, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await db.execute({ sql: `SELECT id FROM ${table} WHERE slug = ? LIMIT 1`, args: [candidate] });
    if (existing.rows.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function fieldValue(form: FormData, field: FieldConfig): Promise<string | number | null> {
  if (field.type === 'checkbox') return form.has(field.key) ? 1 : 0;
  if (field.type === 'image') return resolveImageField(form, field.key);
  const raw = form.get(field.key);
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (field.type === 'number') return s ? Number(s) : null;
  return s ? s : null;
}

function invalidate(config: SimpleCrudConfig) {
  if (config.cacheKey === '__ALL__') invalidateCache();
  else invalidateCache(config.cacheKey);
}

export async function listRows(db: Client, config: SimpleCrudConfig) {
  const orderBy = config.orderColumn ? `${config.orderColumn}, id` : 'id';
  const result = await db.execute(`SELECT * FROM ${config.table} ORDER BY ${orderBy}`);
  return result.rows;
}

export interface ActionResult {
  redirect: string;
}

export async function handleSimpleCrudAction(
  db: Client,
  config: SimpleCrudConfig,
  form: FormData,
  basePath: string
): Promise<ActionResult> {
  const action = String(form.get('action') ?? '');

  try {
    if (action === 'add') {
      if (config.allowAdd === false) throw new Error('Adding new items is disabled for this content type.');

      const columns: string[] = [];
      const placeholders: string[] = [];
      const values: (string | number | null)[] = [];

      for (const field of config.fields) {
        const value = await fieldValue(form, field);
        if (field.required && (value === '' || value === null)) {
          throw new Error(`${field.label} is required.`);
        }
        columns.push(field.key);
        placeholders.push('?');
        values.push(value);
      }

      if (config.hasSlug) {
        const sourceField = config.slugSourceField ?? config.fields[0].key;
        const sourceValue = String(form.get(sourceField) ?? '').trim() || 'item';
        const slug = await uniqueSlug(db, config.table, slugify(sourceValue));
        columns.unshift('slug');
        placeholders.unshift('?');
        values.unshift(slug);
      }

      if (config.orderColumn) {
        const maxRow = (
          await db.execute(`SELECT COALESCE(MAX(${config.orderColumn}), -1) AS m FROM ${config.table}`)
        ).rows[0];
        const nextOrder = Number(maxRow?.m ?? -1) + 1;
        columns.push(config.orderColumn);
        placeholders.push('?');
        values.push(nextOrder);
      }

      await db.execute({
        sql: `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
        args: values,
      });
      invalidate(config);
      return { redirect: `${basePath}?saved=1` };
    }

    if (action === 'edit') {
      const id = Number(form.get('id'));
      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      for (const field of config.fields) {
        const value = await fieldValue(form, field);
        if (field.required && (value === '' || value === null)) {
          throw new Error(`${field.label} is required.`);
        }
        sets.push(`${field.key} = ?`);
        values.push(value);
      }
      sets.push('updated_at = unixepoch()');
      values.push(id);

      await db.execute({ sql: `UPDATE ${config.table} SET ${sets.join(', ')} WHERE id = ?`, args: values });
      invalidate(config);
      return { redirect: `${basePath}?saved=1` };
    }

    if (action === 'delete') {
      if (config.allowDelete === false) throw new Error('Deleting items is disabled for this content type.');
      const id = Number(form.get('id'));
      await db.execute({ sql: `DELETE FROM ${config.table} WHERE id = ?`, args: [id] });
      invalidate(config);
      return { redirect: `${basePath}?saved=1` };
    }

    if (action === 'move') {
      if (!config.orderColumn) throw new Error('This content type has no order to change.');
      const id = Number(form.get('id'));
      const direction = String(form.get('direction'));
      const rows = (
        await db.execute(`SELECT id, ${config.orderColumn} AS ord FROM ${config.table} ORDER BY ${config.orderColumn}, id`)
      ).rows;
      const idx = rows.findIndex((r) => Number(r.id) === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (idx !== -1 && swapIdx >= 0 && swapIdx < rows.length) {
        const a = rows[idx];
        const b = rows[swapIdx];
        await db.execute({ sql: `UPDATE ${config.table} SET ${config.orderColumn} = ? WHERE id = ?`, args: [b.ord, a.id] });
        await db.execute({ sql: `UPDATE ${config.table} SET ${config.orderColumn} = ? WHERE id = ?`, args: [a.ord, b.id] });
        invalidate(config);
      }
      return { redirect: `${basePath}?saved=1` };
    }

    throw new Error('Unknown action.');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    return { redirect: `${basePath}?error=${encodeURIComponent(message)}` };
  }
}
