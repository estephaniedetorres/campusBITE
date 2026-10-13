// CampusBITE design tokens — derived from the landing page (Mobbin / Subway pattern):
// deep green brand, warm cream surfaces, bold tight sans headlines, pill controls.
export const C = {
  green: '#0F4C4A',
  greenDark: '#0A3330',
  greenSoft: '#E6F2F0',
  cream: '#F4F1E6',     // floating nav / pill surfaces
  creamLight: '#FBF6E4',
  page: '#F7F5EE',      // app background
  card: '#FFFFFF',
  ink: '#1C1917',
  inkSoft: '#44403C',
  muted: '#78716C',
  line: '#E7E2D6',
  accent: '#EA580C',    // badges / highlights
  success: '#047857',
  danger: '#B91C1C',
  star: '#F59E0B',
} as const;

export const R = { pill: 999, card: 22, sheet: 28 } as const;

export const shadow = {
  float: { elevation: 10, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  card: { elevation: 2, shadowColor: '#1C1917', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
} as const;
