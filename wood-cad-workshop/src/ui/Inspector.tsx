import { useState } from 'react'
import { getComponent, checkPullupBarBending, checkPullupBarConnection, type StructuralCheckStatus } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const STATUS_COLORS: Record<StructuralCheckStatus, string> = {
  safe: '#2e7d32',
  warning: '#f9a825',
  unsafe: '#c62828',
}

const SOURCE_LINK_COLOR = '#4a90d9'

function formatSafetyFactor(safetyFactor: number): string {
  return Number.isFinite(safetyFactor) ? safetyFactor.toFixed(2) : '∞'
}

// One result row (bending or connection check) — status chip, safety
// factor, and its own explicit, distinctly colored source citation link.
// Each check cites a different species (see the structural-check spec's
// 2026-09-05 amendment) — sourceLabel must name it, never a bare
// "Source ↗", so the two rows never read as one shared basis.
function StructuralResultRow({
  label,
  status,
  safetyFactor,
  sourceLabel,
  sourceUrl,
}: {
  label: string
  status: StructuralCheckStatus
  safetyFactor: number
  sourceLabel: string
  sourceUrl: string
}) {
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: STATUS_COLORS[status],
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span>
          {label}: {formatSafetyFactor(safetyFactor)} ({status})
        </span>
      </div>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 11, color: SOURCE_LINK_COLOR, display: 'block', marginTop: 2 }}
      >
        Source: {sourceLabel} ↗
      </a>
    </div>
  )
}

export function Inspector() {
  const selectedId = useSceneSession((s) => s.selectedId)
  const instance = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const changeDimensions = useSceneSession((s) => s.changeDimensions)
  const movePiece = useSceneSession((s) => s.movePiece)
  const [userWeightKg, setUserWeightKg] = useState(80)
  const [collapsed, setCollapsed] = useState(false)

  if (!selectedId || !instance) return null
  const definition = getComponent(instance.componentDefinitionId)

  const setDimension = (key: string, value: number) => {
    if (Number.isNaN(value)) return
    changeDimensions(instance.id, { ...instance.dimensions, [key]: value })
  }

  const setPositionAxis = (axis: 0 | 1 | 2, value: number) => {
    if (Number.isNaN(value)) return
    const next: [number, number, number] = [...instance.position]
    next[axis] = value
    movePiece(instance.id, next)
  }

  const isPullupBar = instance.componentDefinitionId === 'pullup_bar'
  const { bendingStrength, connectionCapacity } = definition.structuralProperties
  const bendingResult =
    isPullupBar && bendingStrength !== undefined
      ? checkPullupBarBending({
          diameterIn: instance.dimensions.diameter,
          lengthIn: instance.dimensions.length,
          userWeightKg,
          bendingStrength,
        })
      : null
  const connectionResult =
    isPullupBar && connectionCapacity !== undefined ? checkPullupBarConnection({ userWeightKg, connectionCapacity }) : null
  const showStructuralSection = bendingResult !== null || connectionResult !== null

  if (collapsed) {
    return (
      <div
        style={{
          width: 'min(140px, 34vw)',
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid #ccc',
          borderRadius: 8,
          padding: '6px 8px',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {definition.name}
        </span>
        <button onClick={() => setCollapsed(false)} style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}>
          ⤢
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 'min(200px, 46vw)',
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 'bold' }}>{definition.name}</span>
        <button onClick={() => setCollapsed(true)} style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}>
          ▬
        </button>
      </div>

      <div style={{ fontWeight: 'bold', marginTop: 6 }}>Dimensions</div>
      {Object.entries(instance.dimensions).map(([key, value]) => (
        <label
          key={key}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}
        >
          <span style={{ textTransform: 'capitalize' }}>{key}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setDimension(key, e.target.valueAsNumber)}
            style={{ width: 80, minHeight: 44 }}
          />
        </label>
      ))}

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Position</div>
      {(['x', 'y', 'z'] as const).map((label, axis) => (
        <label
          key={label}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}
        >
          <span>{label}</span>
          <input
            type="number"
            value={instance.position[axis]}
            onChange={(e) => setPositionAxis(axis as 0 | 1 | 2, e.target.valueAsNumber)}
            style={{ width: 80, minHeight: 44 }}
          />
        </label>
      ))}

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Rotation</div>
      <div>
        x: {((instance.rotation[0] * 180) / Math.PI).toFixed(0)}°, y:{' '}
        {((instance.rotation[1] * 180) / Math.PI).toFixed(0)}°, z:{' '}
        {((instance.rotation[2] * 180) / Math.PI).toFixed(0)}°
      </div>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Material</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 16,
            height: 16,
            background: instance.material,
            border: '1px solid #999',
            display: 'inline-block',
          }}
        />
        {instance.material}
      </div>

      {showStructuralSection && (
        <>
          <div style={{ fontWeight: 'bold', marginTop: 8 }}>Structural Check (estimate)</div>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span>User weight (kg)</span>
            <input
              type="number"
              min={1}
              value={userWeightKg}
              onChange={(e) => {
                const value = e.target.valueAsNumber
                if (!Number.isNaN(value)) setUserWeightKg(Math.max(1, value))
              }}
              style={{ width: 80, minHeight: 44 }}
            />
          </label>
          {bendingResult && (
            <StructuralResultRow
              label="Bending safety factor"
              status={bendingResult.status}
              safetyFactor={bendingResult.safetyFactor}
              sourceLabel="red oak, USDA Wood Handbook"
              sourceUrl="https://www.fpl.fs.usda.gov/documnts/fplgtr/fplgtr190/chapter_05.pdf"
            />
          )}
          {connectionResult && (
            <StructuralResultRow
              label="Connection safety factor"
              status={connectionResult.status}
              safetyFactor={connectionResult.safetyFactor}
              sourceLabel="spruce dowel joint, woodgears.ca"
              sourceUrl="https://woodgears.ca/joint_strength/"
            />
          )}
          <div style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
            Estimate only — not a certified structural analysis.
          </div>
        </>
      )}
    </div>
  )
}
