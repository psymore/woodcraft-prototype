export function ExplodedView({
  amount,
  onChange,
}: {
  amount: number
  onChange: (amount: number) => void
}) {
  const active = amount > 0

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        left: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 8,
        zIndex: 1,
      }}
    >
      <button
        onClick={() => onChange(active ? 0 : 0.5)}
        style={{ minWidth: 44, minHeight: 44 }}
      >
        {active ? 'ASSEMBLE' : 'EXPLODE'}
      </button>
      {active && (
        <>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(amount * 100)}
            onChange={(e) => onChange(Number(e.target.value) / 100)}
            style={{ width: 140, height: 44 }}
          />
          <span style={{ minWidth: 36 }}>{Math.round(amount * 100)}%</span>
        </>
      )}
    </div>
  )
}
