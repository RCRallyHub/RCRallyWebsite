import { getDb } from '../db';
import { cached } from './cache';

export interface NavLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: NavLink[];
}

export interface NavigationData {
  header: NavLink[];
  footer: FooterColumn[];
}

async function fetchNavigation(): Promise<NavigationData> {
  const db = getDb();
  const rows = (
    await db.execute(
      `SELECT label, href, location, group_label FROM navigation_items WHERE enabled = 1 ORDER BY location, group_label, sort_order`
    )
  ).rows;

  const header: NavLink[] = [];
  const footerGroups = new Map<string, NavLink[]>();
  const footerOrder: string[] = [];

  for (const r of rows) {
    const link: NavLink = { label: String(r.label), href: String(r.href) };
    if (r.location === 'header') {
      header.push(link);
    } else {
      const group = r.group_label ? String(r.group_label) : '';
      if (!footerGroups.has(group)) {
        footerGroups.set(group, []);
        footerOrder.push(group);
      }
      footerGroups.get(group)!.push(link);
    }
  }

  const footer: FooterColumn[] = footerOrder.map((title) => ({ title, links: footerGroups.get(title)! }));

  return { header, footer };
}

export function getNavigation(): Promise<NavigationData> {
  return cached('navigation', fetchNavigation);
}
