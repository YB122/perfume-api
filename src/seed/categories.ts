import { Category } from '../models/Category';

const SEED: Array<{
  name: { en: string; fr: string; ar: string };
  slug: { en: string; fr: string; ar: string };
}> = [
  {
    name: { en: 'Men', fr: 'Hommes', ar: 'رجال' },
    slug: { en: 'men', fr: 'hommes', ar: 'رجال' },
  },
  {
    name: { en: 'Ladies', fr: 'Femmes', ar: 'نساء' },
    slug: { en: 'ladies', fr: 'femmes', ar: 'نساء' },
  },
];

// Idempotent: creates Men/Ladies once, leaves existing ones untouched.
export async function seedCategories(): Promise<void> {
  for (const c of SEED) {
    await Category.findOneAndUpdate(
      { 'slug.en': c.slug.en },
      { name: c.name, slug: c.slug, deletedAt: null },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  }
}
