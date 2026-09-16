import { Moon, Sun } from 'lucide-react'
import type { Theme } from './theme'

// Bottom-left, mirroring the top-left menu button's safe-area corner —
// a round "orb" rather than the app's usual rounded-square buttons, so it
// reads as its own distinct control rather than another menu item. Shows
// the icon for what a tap switches TO (Sun while dark, inviting "turn the
// light on"), not the current mode.
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        position: 'absolute',
        bottom: 'max(8px, env(safe-area-inset-bottom))',
        left: 'max(8px, env(safe-area-inset-left))',
        zIndex: 1,
        width: 44,
        height: 44,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--wc-panel)',
        color: 'var(--wc-text)',
        border: '1px solid var(--wc-border-button)',
      }}
    >
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  )
}
