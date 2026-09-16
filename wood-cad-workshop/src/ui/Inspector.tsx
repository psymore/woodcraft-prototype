import { useEffect, useState } from 'react'
import { PanelRightClose, PanelRightOpen, X } from 'lucide-react'
import {
  getComponent,
  checkPullupBarBending,
  checkPullupBarConnection,
  getSpecies,
  SPECIES_LIST,
  type StructuralCheckStatus,
  type ComponentInstance,
  type Connection,
} from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const STATUS_COLORS: Record<StructuralCheckStatus, string> = {
  safe: 'var(--wc-safe)',
  warning: 'var(--wc-warn)',
  unsafe: 'var(--wc-unsafe)',
}

const SOURCE_LINK_COLOR = 'var(--wc-accent)'

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

// Freestanding HARDWARE/FASTENER pieces available to link to a
// connection: any such instance not already linked to ANY connection
// (a physical bracket/screw reinforces one joint at a time — see
// attachHardware's own no-op guard in sceneSessionStore.ts).
function unlinkedHardware(instances: ComponentInstance[], connections: Connection[]) {
  const linkedIds = new Set(connections.flatMap((c) => c.hardwarePieceIds ?? []))
  return instances.filter((i) => {
    if (linkedIds.has(i.id)) return false
    const category = getComponent(i.componentDefinitionId).category
    return category === 'HARDWARE' || category === 'FASTENER'
  })
}

function ConnectionPanel({ connectionId }: { connectionId: string }) {
  const instances = useSceneSession((s) => s.instances)
  const connection = useSceneSession((s) => s.connections.find((c) => c.id === connectionId) ?? null)
  const connections = useSceneSession((s) => s.connections)
  const selectConnection = useSceneSession((s) => s.selectConnection)
  const detachConnection = useSceneSession((s) => s.detachConnection)
  const attachHardware = useSceneSession((s) => s.attachHardware)
  const detachHardware = useSceneSession((s) => s.detachHardware)
  const toggleGlue = useSceneSession((s) => s.toggleGlue)

  if (!connection) return null

  const attached = (connection.hardwarePieceIds ?? [])
    .map((id) => instances.find((i) => i.id === id))
    .filter((i): i is NonNullable<typeof i> => i !== undefined)
  const available = unlinkedHardware(instances, connections)

  return (
    <div
      style={{
        width: 'min(200px, 46vw)',
        background: 'var(--wc-panel)',
        color: 'var(--wc-text)',
        border: '1px solid var(--wc-border)',
        borderRadius: 10,
        padding: 10,
        fontSize: 13,
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 'bold' }}>Connection</span>
        <button onClick={() => selectConnection(null)} title="Close" style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}>
          <X size={16} />
        </button>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <input type="checkbox" checked={connection.glued ?? false} onChange={() => toggleGlue(connection.id)} style={{ width: 20, height: 20 }} />
        <span>Glued</span>
      </label>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Hardware</div>
      {attached.length === 0 && <div style={{ color: 'var(--wc-muted)', marginTop: 4 }}>None attached</div>}
      {attached.map((piece) => (
        <div key={piece.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span>{getComponent(piece.componentDefinitionId).name}</span>
          <button onClick={() => detachHardware(connection.id, piece.id)} style={{ minWidth: 32, minHeight: 32 }}>
            ✕
          </button>
        </div>
      ))}
      {available.length > 0 && (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
          <span>Attach</span>
          <select
            aria-label="Attach hardware"
            value=""
            onChange={(e) => {
              if (e.target.value) attachHardware(connection.id, e.target.value)
            }}
            style={{ minHeight: 44 }}
          >
            <option value="" disabled>
              Choose…
            </option>
            {available.map((piece) => (
              <option key={piece.id} value={piece.id}>
                {getComponent(piece.componentDefinitionId).name}
              </option>
            ))}
          </select>
        </label>
      )}

      <button
        onClick={() => detachConnection(connection.id)}
        style={{ minWidth: '100%', minHeight: 44, marginTop: 10, color: 'var(--wc-unsafe)' }}
      >
        Detach connection
      </button>
    </div>
  )
}

export function Inspector() {
  const selectedId = useSceneSession((s) => s.selectedId)
  const selectedConnectionId = useSceneSession((s) => s.selectedConnectionId)
  const instance = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const changeDimensions = useSceneSession((s) => s.changeDimensions)
  const movePiece = useSceneSession((s) => s.movePiece)
  const changeSpecies = useSceneSession((s) => s.changeSpecies)
  const [userWeightKg, setUserWeightKg] = useState(80)
  const [collapsed, setCollapsed] = useState(true)

  // Reset to collapsed on every new selection so pressing a piece never
  // pops the full dimension panel open unasked — only re-expanding it
  // (the PanelRightOpen button below) does. Keyed on selectedId, not a mount-only
  // default, so this also applies when switching between pieces without
  // ever deselecting.
  useEffect(() => {
    setCollapsed(true)
  }, [selectedId])

  if (selectedConnectionId) return <ConnectionPanel connectionId={selectedConnectionId} />

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
  const { connectionCapacity } = definition.structuralProperties
  const species = getSpecies(instance.speciesId)
  const bendingResult =
    isPullupBar && species !== undefined
      ? checkPullupBarBending({
          diameterIn: instance.dimensions.diameter,
          lengthIn: instance.dimensions.length,
          userWeightKg,
          bendingStrength: species.bendingStrength,
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
          background: 'var(--wc-panel)',
          color: 'var(--wc-text)',
          border: '1px solid var(--wc-border)',
          borderRadius: 10,
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
        <button onClick={() => setCollapsed(false)} title="Expand" style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}>
          <PanelRightOpen size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        width: 'min(200px, 46vw)',
        background: 'var(--wc-panel)',
        color: 'var(--wc-text)',
        border: '1px solid var(--wc-border)',
        borderRadius: 10,
        padding: 10,
        fontSize: 13,
        maxHeight: '70vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 'bold' }}>{definition.name}</span>
        <button onClick={() => setCollapsed(true)} title="Collapse" style={{ minWidth: 32, minHeight: 32, flexShrink: 0 }}>
          <PanelRightClose size={16} />
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

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>{definition.category === 'WOOD' ? 'Species' : 'Material'}</div>
      {definition.category === 'WOOD' ? (
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span
            style={{
              width: 16,
              height: 16,
              background: instance.material,
              border: '1px solid var(--wc-border)',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <select
            aria-label="Species"
            value={instance.speciesId ?? ''}
            onChange={(e) => changeSpecies(instance.id, e.target.value)}
            style={{ minHeight: 44 }}
          >
            {SPECIES_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              width: 16,
              height: 16,
              background: instance.material,
              border: '1px solid var(--wc-border)',
              display: 'inline-block',
            }}
          />
          {instance.material}
        </div>
      )}

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
          {bendingResult && species && (
            <StructuralResultRow
              label="Bending safety factor"
              status={bendingResult.status}
              safetyFactor={bendingResult.safetyFactor}
              sourceLabel={species.sourceLabel}
              sourceUrl={species.sourceUrl}
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
          <div style={{ fontSize: 11, color: 'var(--wc-muted)', marginTop: 6 }}>
            Estimate only — not a certified structural analysis.
          </div>
        </>
      )}
    </div>
  )
}
