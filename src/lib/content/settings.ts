import { getDb } from '../db';
import { cached } from './cache';

export interface SettingsData {
  businessName: string;
  tagline?: string;
  logo: string;
  favicon?: string;
  address: string;
  locationDescription: string;
  operatingHours: string;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  contact: {
    mobile: string;
    mobileIsDummy: boolean;
    email: string;
    emailIsDummy: boolean;
    facebook: string;
    facebookIsDummy: boolean;
    messenger?: string;
    mapEmbedUrl?: string;
    mapUrl?: string;
  };
  social?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  };
  announcementBar?: {
    enabled: boolean;
    message?: string;
    link?: string;
  };
  bookingButtonText: string;
  bookingUrl: string;
  footer?: {
    description?: string;
    copyrightName?: string;
  };
  defaultSeo?: {
    seoTitle?: string;
    metaDescription?: string;
    ogImage?: string;
  };
}

async function fetchSettings(): Promise<SettingsData> {
  const db = getDb();
  const row = (await db.execute('SELECT * FROM business_settings WHERE id = 1')).rows[0];
  if (!row) throw new Error('business_settings row missing — run scripts/migrate-to-turso.mjs');

  const socialRows = (
    await db.execute('SELECT platform, url FROM social_links WHERE enabled = 1 ORDER BY sort_order')
  ).rows;
  const social: Record<string, string> = {};
  for (const s of socialRows) {
    social[String(s.platform)] = String(s.url);
  }

  return {
    businessName: String(row.business_name),
    tagline: row.tagline ? String(row.tagline) : undefined,
    logo: String(row.logo_url),
    favicon: row.favicon_url ? String(row.favicon_url) : undefined,
    address: String(row.address),
    locationDescription: String(row.location_description),
    operatingHours: String(row.operating_hours),
    operatingHoursStart: String(row.operating_hours_start),
    operatingHoursEnd: String(row.operating_hours_end),
    contact: {
      mobile: String(row.contact_mobile),
      mobileIsDummy: !!row.contact_mobile_is_dummy,
      email: String(row.contact_email),
      emailIsDummy: !!row.contact_email_is_dummy,
      facebook: String(row.contact_facebook),
      facebookIsDummy: !!row.contact_facebook_is_dummy,
      messenger: row.contact_messenger ? String(row.contact_messenger) : undefined,
      mapEmbedUrl: row.map_embed_url ? String(row.map_embed_url) : undefined,
      mapUrl: row.map_url ? String(row.map_url) : undefined,
    },
    social,
    announcementBar: {
      enabled: !!row.announcement_enabled,
      message: row.announcement_message ? String(row.announcement_message) : undefined,
      link: row.announcement_link ? String(row.announcement_link) : undefined,
    },
    bookingButtonText: String(row.booking_button_text),
    bookingUrl: String(row.booking_url),
    footer: {
      description: row.footer_description ? String(row.footer_description) : undefined,
      copyrightName: row.footer_copyright_name ? String(row.footer_copyright_name) : undefined,
    },
    defaultSeo: {
      seoTitle: row.default_seo_title ? String(row.default_seo_title) : undefined,
      metaDescription: row.default_seo_meta_description ? String(row.default_seo_meta_description) : undefined,
      ogImage: row.default_seo_og_image ? String(row.default_seo_og_image) : undefined,
    },
  };
}

export function getSettings(): Promise<SettingsData> {
  return cached('settings', fetchSettings);
}
