import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { secureKeyValue } from '@/lib/secure-store';

export type ThemeMode = 'system' | 'light' | 'dark';
type Palette = {
  background: string; surface: string; elevated: string; border: string; text: string; muted: string; faint: string;
  mint: string; mintSoft: string; violet: string; violetSoft: string; amber: string; amberSoft: string;
  red: string; redSoft: string; sky: string; skySoft: string; tab: string;
};
const palettes: Record<'light' | 'dark', Palette> = {
  dark: {
    background: '#070A12', surface: '#101522', elevated: '#171D2B', border: 'rgba(255,255,255,0.09)',
    text: '#F8FAFC', muted: '#9AA8BD', faint: '#66758B', mint: '#70E4D4', mintSoft: 'rgba(112,228,212,0.13)',
    violet: '#9B7BFF', violetSoft: 'rgba(155,123,255,0.14)', amber: '#F7C873', amberSoft: 'rgba(247,200,115,0.14)',
    red: '#FB7185', redSoft: 'rgba(251,113,133,0.14)', sky: '#7DD3FC', skySoft: 'rgba(125,211,252,0.14)', tab: '#0D121D',
  },
  light: {
    background: '#F5F7FB', surface: '#FFFFFF', elevated: '#EEF2F8', border: 'rgba(12,20,35,0.09)',
    text: '#111827', muted: '#526176', faint: '#77849A', mint: '#078C7E', mintSoft: 'rgba(7,140,126,0.10)',
    violet: '#6547D9', violetSoft: 'rgba(101,71,217,0.10)', amber: '#A86500', amberSoft: 'rgba(168,101,0,0.10)',
    red: '#C82D4D', redSoft: 'rgba(200,45,77,0.10)', sky: '#087BA8', skySoft: 'rgba(8,123,168,0.10)', tab: '#FFFFFF',
  },
};

export const tokens = {
  space: { xs: 6, sm: 10, md: 16, lg: 22, xl: 30 },
  radius: { sm: 10, md: 16, lg: 22, pill: 999 },
  font: { xs: 11, sm: 13, md: 15, lg: 20, xl: 28 },
};

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  colors: Palette;
  setMode: (mode: ThemeMode) => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme() === 'light' ? 'light' : 'dark';
  const [mode, setModeState] = useState<ThemeMode>('system');
  useEffect(() => {
    secureKeyValue.getItem('madar-theme-mode').then((saved) => {
      if (saved === 'system' || saved === 'light' || saved === 'dark') setModeState(saved);
    });
  }, []);
  const resolved = mode === 'system' ? system : mode;
  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    resolved,
    colors: palettes[resolved],
    setMode: async (next) => {
      setModeState(next);
      await secureKeyValue.setItem('madar-theme-mode', next);
    },
  }), [mode, resolved]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useMadarTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('MadarThemeProviderMissing');
  return value;
}
