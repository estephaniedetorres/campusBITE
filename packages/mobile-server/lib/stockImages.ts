// Bundled offline photos (assets/stock/<name>.jpg, served at /api/images/<name>.jpg).
// Originals are from Unsplash (https://unsplash.com/license), downloaded and resized to 1200px.
// Shared by the server (seed + migration) and the app (fallback images).

export const STOCK_IMAGES = {
  'potato-corner': 'photo-1573080496219-bb080dd4f877',
  'matees': 'photo-1488900128323-21503983a07e',
  'choco-scoop': 'photo-1563805042-7684c019e1cb',
  'cheese-fries': 'photo-1585109649139-366815a0d713',
  'canteen': 'photo-1504674900247-0877df9cc836',
  'coffee': 'photo-1495474472287-4d71bcdd2085',
  'burger': 'photo-1568909344668-6f14a07b56a0',
  'burger-double': 'photo-1550547660-d9450f859349',
  'milk-tea': 'photo-1571934811356-5cc061b6821f',
  'croissant': 'photo-1509440159596-0249088772ff',
  'staff-pos': 'photo-1556742049-0cfed4f6a45d',
  'staff-kds': 'photo-1556910103-1c02745aae4d',
  'staff-login': 'photo-1567521464027-f127ff144326',
} as const;

export type StockImageName = keyof typeof STOCK_IMAGES;

// Photos the old seed used that Unsplash no longer serves (404) → closest bundled photo
const RETIRED: Record<string, StockImageName> = {
  'photo-1495147466023-a36482277724': 'matees', // vanilla scoop
  'photo-1630384060421-c342d74f260f': 'cheese-fries', // loaded fries
  'photo-1604908177223-81e336fca6a2': 'canteen', // rice & chicken
};

/** Relative URL of a bundled photo. Prefix with the API base on native (see resolveImageUrl). */
export function stockImage(name: StockImageName): string {
  return `/api/images/${name}.jpg`;
}

/** Map a known Unsplash URL to its bundled copy; returns the input unchanged otherwise. */
export function toLocalImage(url: string | null | undefined): string | null | undefined {
  if (!url || !url.includes('images.unsplash.com')) return url;
  for (const [name, id] of Object.entries(STOCK_IMAGES)) {
    if (url.includes(id)) return stockImage(name as StockImageName);
  }
  for (const [id, name] of Object.entries(RETIRED)) {
    if (url.includes(id)) return stockImage(name);
  }
  return url;
}
