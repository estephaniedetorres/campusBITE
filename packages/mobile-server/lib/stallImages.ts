// Large hero photo per stall: the stall's own image (upscaled) or a keyword fallback.
export type StallLike = { name: string; description?: string | null; logo_url?: string | null };

const fallbacks: { match: RegExp; url: string }[] = [
  { match: /fries|potato/i, url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=1400&auto=format&fit=crop&q=70' },
  { match: /ice cream|sundae|matees|shake/i, url: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=1400&auto=format&fit=crop&q=70' },
  { match: /coffee|brew|tea/i, url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1400&auto=format&fit=crop&q=70' },
  { match: /burger|grill/i, url: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=1400&auto=format&fit=crop&q=70' },
];
const generic = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&auto=format&fit=crop&q=70';

export function stallHeroImage(s: StallLike): string {
  if (s.logo_url) return s.logo_url.replace(/([?&])w=\d+/, '$1w=1400');
  const text = `${s.name} ${s.description || ''}`;
  return fallbacks.find(f => f.match.test(text))?.url || generic;
}
