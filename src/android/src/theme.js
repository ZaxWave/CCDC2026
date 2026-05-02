import { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'

const palette = {
  blue: '#3e6ae1',
  green: '#1a8045',
  red: '#d93025',
  amber: '#f59e0b',
}

const themes = {
  dark: {
    mode: 'dark',
    isDark: true,
    bg: '#171A20',
    bgAlt: '#101318',
    panel: 'rgba(255,255,255,0.03)',
    panelStrong: 'rgba(255,255,255,0.06)',
    surface: 'rgba(255,255,255,0.045)',
    surfaceStrong: 'rgba(255,255,255,0.08)',
    text: '#ffffff',
    textSoft: 'rgba(255,255,255,0.72)',
    textMuted: 'rgba(255,255,255,0.48)',
    textFaint: 'rgba(255,255,255,0.32)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.15)',
    overlay: 'rgba(0,0,0,0.58)',
    overlaySoft: 'rgba(0,0,0,0.42)',
    input: 'rgba(255,255,255,0.045)',
    shadow: '#000000',
    ...palette,
    blueSoft: 'rgba(62,106,225,0.14)',
    blueText: '#8fb0ff',
  },
  light: {
    mode: 'light',
    isDark: false,
    bg: '#f5f6f8',
    bgAlt: '#ffffff',
    panel: '#ffffff',
    panelStrong: '#f1f3f7',
    surface: '#f7f8fb',
    surfaceStrong: '#eef1f6',
    text: '#171A20',
    textSoft: '#393C41',
    textMuted: '#60646c',
    textFaint: '#8b9098',
    border: '#dce0e7',
    borderStrong: '#c7cdd7',
    overlay: 'rgba(17,24,39,0.72)',
    overlaySoft: 'rgba(17,24,39,0.48)',
    input: '#ffffff',
    shadow: '#9aa3b2',
    ...palette,
    blueSoft: 'rgba(62,106,225,0.10)',
    blueText: '#3156bd',
  },
}

const ThemeContext = createContext(themes.dark)

export function ThemeProvider({ children }) {
  const scheme = useColorScheme()
  const theme = useMemo(() => themes[scheme === 'light' ? 'light' : 'dark'], [scheme])
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

export function useThemedStyles(factory) {
  const theme = useTheme()
  return useMemo(() => factory(theme), [factory, theme])
}
