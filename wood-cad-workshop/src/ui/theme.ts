export type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'wc-theme'

// A per-viewer UI convenience, same as MainMenu's showLabels toggle — read
// straight from localStorage rather than the Zustand store. Defaults to
// dark (the app's original, only theme before this).
export function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function writeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Best-effort — a private window or blocked storage just means the
    // choice doesn't persist across reloads, not that toggling stops working.
  }
}
