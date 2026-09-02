import { DarkThemeColors, LightThemeColors, SharedFonts, SharedThemeTokens } from '../../../shared/design';

type ThemeValue = string | number;

function setCssVar(name: string, value: ThemeValue) {
  document.documentElement.style.setProperty(`--${name}`, String(value));
}

export function applyThemeVars(isDarkMode = true) {
  const colors = isDarkMode ? DarkThemeColors : LightThemeColors;

  setCssVar('font-body', SharedFonts.body);
  setCssVar('font-heading', SharedFonts.heading);

  Object.entries(colors).forEach(([key, value]) => {
    setCssVar(`color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`, value);
  });

  Object.entries(SharedThemeTokens).forEach(([key, value]) => {
    setCssVar(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
  });
}

export const theme = {
  colors: DarkThemeColors,
  fonts: SharedFonts,
  tokens: SharedThemeTokens,
};
