// Image URLs for the app UI. Everything resolves to bundled offline photos (/api/images/*) or
// admin uploads (/api/uploads/*), made absolute for Expo Go via resolveImageUrl.
import { resolveImageUrl } from '../constants/api';
import { stockImage, toLocalImage, StockImageName } from './stockImages';

export type StallLike = { name: string; description?: string | null; logo_url?: string | null };
type ItemLike = { name: string; image_url?: string | null };

const byKeyword: { match: RegExp; name: StockImageName }[] = [
  { match: /fries|potato/i, name: 'potato-corner' },
  { match: /ice cream|sundae|scoop|matees|shake/i, name: 'matees' },
  { match: /coffee|latte|brew/i, name: 'coffee' },
  { match: /milk|tea/i, name: 'milk-tea' },
  { match: /double/i, name: 'burger-double' },
  { match: /burger|grill/i, name: 'burger' },
  { match: /croissant|pastr|bread/i, name: 'croissant' },
];

function keywordImage(text: string): string {
  return stockImage(byKeyword.find((k) => k.match.test(text))?.name ?? 'canteen');
}

/** Large hero photo per stall: its own photo, else a keyword match, else the canteen photo. */
export function stallHeroImage(s: StallLike): string {
  const own = toLocalImage(s.logo_url);
  return resolveImageUrl(own || keywordImage(`${s.name} ${s.description || ''}`))!;
}

/** Menu item photo: its own photo, else a keyword match on the item name. */
export function menuItemImage(item: ItemLike): string {
  const own = toLocalImage(item.image_url);
  return resolveImageUrl(own || keywordImage(item.name))!;
}
