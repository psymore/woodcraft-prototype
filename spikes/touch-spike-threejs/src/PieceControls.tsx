export function PieceControls({
  hasSelection,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  hasSelection: boolean
  onRotate: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  if (!hasSelection) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        display: 'flex',
        gap: 4,
        zIndex: 1,
      }}
    >
      <button onClick={onRotate} style={{ minWidth: 44, minHeight: 44 }}>
        ROTATE
      </button>
      <button onClick={onDuplicate} style={{ minWidth: 44, minHeight: 44 }}>
        DUPLICATE
      </button>
      <button onClick={onDelete} style={{ minWidth: 44, minHeight: 44 }}>
        DELETE
      </button>
    </div>
  )
}
