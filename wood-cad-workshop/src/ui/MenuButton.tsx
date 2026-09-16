import type { ReactNode } from 'react'
import { panelButtonStyle } from './buttonStyle'

// Shared icon(+optional label) button for every control inside MainMenu's
// dropdown — standardizes them all on icon-first, with `showLabels` (the
// menu's own toggle, see MainMenu.tsx) switching the text back on for
// anyone who finds the icons alone unclear. `title` always carries the full
// label as a tooltip/a11y name regardless of `showLabels`, since hiding the
// text visually shouldn't hide it from screen readers or hover users.
export function MenuButton({
  icon,
  label,
  showLabels,
  onClick,
  active = false,
  disabled = false,
}: {
  icon: ReactNode
  label: string
  showLabels: boolean
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={panelButtonStyle(active)} title={label}>
      {icon}
      {showLabels && <span>{label}</span>}
    </button>
  )
}
