export const SharedFonts = {
  body: 'Inter, system-ui, sans-serif',
  heading: 'Inter, system-ui, sans-serif'
};

export const LightThemeColors = {
  primary: '#38bdf8',
  primaryLight: '#7dd3fc',
  background: '#f8fafc',
  surface: '#ffffff',
  card: '#ffffff',
  text: '#0f172a',
  textDim: '#64748b',
  border: '#e2e8f0',
  accent: '#0ea5e9',
  gold: '#f59e0b',
  success: '#16a34a',
  warning: '#fbbf24',
  danger: '#dc2626',
  statusBar: 'dark',
  shadowColor: '#000000'
};

export const DarkThemeColors = {
  primary: '#38bdf8',
  primaryLight: '#7dd3fc',
  background: '#0f172a',
  surface: '#111827',
  card: '#111827',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  border: '#334155',
  accent: '#22d3ee',
  gold: '#f59e0b',
  success: '#34d399',
  warning: '#fbbf24',
  danger: '#f87171',
  statusBar: 'light',
  shadowColor: '#000000'
};

export const SharedThemeTokens = {
  radius: '0.85rem',
  cardRadius: '1rem',
  shadow: '0 24px 80px rgba(0, 0, 0, 0.18)'
};

export type ThemeColors = typeof DarkThemeColors;
export type ThemeTokens = typeof SharedThemeTokens;
