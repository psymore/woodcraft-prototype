import type { CSSProperties } from 'react'

const IDLE_BACKGROUND = '#1c1815'
// A visible, slightly warm mid-gray ("brushed metal") rather than the
// original near-black #2c2822, which barely showed up against the
// IDLE_BACKGROUND above it — borders were only nominally there.
const IDLE_BORDER = '#6b6055'
const IDLE_TEXT = '#eae6df'
const ACTIVE_BACKGROUND = '#ff7a1a'
const ACTIVE_BORDER = '#ff7a1a'
const ACTIVE_TEXT = '#100c08'
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
