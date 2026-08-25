import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { shouldDismiss } from './bottomSheetGesture'

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const sheetHeight = useRef(0)
  const dragging = useRef(false)
  const [dragDeltaY, setDragDeltaY] = useState(0)

  if (!open) return null

  const handlePointerDown = (e: ReactPointerEvent) => {
    ;(e.target as Element).setPointerCapture(e.pointerId)
    dragging.current = true
    dragStartY.current = e.clientY
    sheetHeight.current = sheetRef.current?.getBoundingClientRect().height ?? 0
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    setDragDeltaY(Math.max(0, e.clientY - dragStartY.current))
  }

  const handlePointerUp = (e: ReactPointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    ;(e.target as Element).releasePointerCapture(e.pointerId)
    if (shouldDismiss(dragDeltaY, sheetHeight.current)) {
      onClose()
    }
    setDragDeltaY(0)
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1,
        }}
      />
      <div
        ref={sheetRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #ccc',
          borderTopLeftRadius: 12,
          borderTopRightRadius: 12,
          zIndex: 1,
          transform: `translateY(${dragDeltaY}px)`,
          maxHeight: '55vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ display: 'flex', justifyContent: 'center', padding: 8, touchAction: 'none' }}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ccc' }} />
        </div>
        <div
          style={{
            overflowY: 'auto',
            padding: '0 10px 10px',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}
