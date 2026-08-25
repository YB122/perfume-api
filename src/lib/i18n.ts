import type { LocalizedString } from '../models/localized';
import type { Context } from 'hono';
import { getLocale } from './auth';

// Flatten a localized field to a single string using the request locale, falling back to English.
export function localize(field: LocalizedString | undefined, c: Context): string {
  if (!field) return '';
  const locale = getLocale(c);
  return field[locale as keyof LocalizedString] || field.en;
}
