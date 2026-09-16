import type { CSSProperties } from 'react'

// Sourced from index.css's custom properties (see --wc-button-idle-bg
// there for why idle isn't just --wc-panel) so this flips with the
// data-theme attribute ThemeToggle.tsx sets, same as everything else.
const IDLE_BACKGROUND = 'var(--wc-button-idle-bg)'
const IDLE_BORDER = 'var(--wc-button-idle-border)'
const IDLE_TEXT = 'var(--wc-text)'
// Active/selected stays the brand accent in both themes, not themed itself.
const ACTIVE_BACKGROUND = 'var(--wc-accent)'
const ACTIVE_BORDER = 'var(--wc-accent)'
const ACTIVE_TEXT = 'var(--wc-accent-contrast)'
const ACTIVE_GLOW = '0 0 8px rgba(255, 122, 26, 0.45)'

// Shared chrome for every button in the app's floating panels — charcoal
// idle state matching MainMenu/BottomSheet's own panel background, orange
// accent (with glow) reserved for genuinely active/toggled state so the
// glow stays a legible "this is on" signal instead of decorating every
// button regardless of state.
export function panelButtonStyle(active = false): CSSProperties {
  return {
    minWidth: 44,
    minHeight: 44,
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: active ? ACTIVE_BACKGROUND : IDLE_BACKGROUND,
    color: active ? ACTIVE_TEXT : IDLE_TEXT,
    border: `1px solid ${active ? ACTIVE_BORDER : IDLE_BORDER}`,
    borderRadius: 8,
    boxShadow: active ? ACTIVE_GLOW : 'none',
    fontSize: 13,
    cursor: 'pointer',
  }
}
