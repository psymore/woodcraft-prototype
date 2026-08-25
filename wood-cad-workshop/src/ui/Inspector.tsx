import { useState } from 'react'
import { getComponent, checkPullupBarBending, type StructuralCheckStatus } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

const STATUS_COLORS: Record<StructuralCheckStatus, string> = {
  safe: '#2e7d32',
  warning: '#f9a825',
  unsafe: '#c62828',
}

export function Inspector() {
  const selectedId = useSceneSession((s) => s.selectedId)
  const instance = useSceneSession((s) => s.instances.find((i) => i.id === s.selectedId) ?? null)
  const changeDimensions = useSceneSession((s) => s.changeDimensions)
  const [userWeightKg, setUserWeightKg] = useState(80)

  if (!selectedId || !instance) return null
  const definition = getComponent(instance.componentDefinitionId)

  const setDimension = (key: string, value: number) => {
    if (Number.isNaN(value)) return
    changeDimensions(instance.id, { ...instance.dimensions, [key]: value })
  }

  const bendingStrength = definition.structuralProperties.bendingStrength
  const showStructuralCheck = instance.componentDefinitionId === 'pullup_bar' && bendingStrength !== undefined
  const structuralResult = showStructuralCheck
    ? checkPullupBarBending({
        diameterIn: instance.dimensions.diameter,
        lengthIn: instance.dimensions.length,
        userWeightKg,
        bendingStrength,
      })
    : null

  return (
    <div
      style={{
        width: 200,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{definition.name}</div>

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
      <div>
        x: {instance.position[0].toFixed(2)}, y: {instance.position[1].toFixed(2)}, z:{' '}
        {instance.position[2].toFixed(2)}
      </div>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Rotation</div>
      <div>yaw: {((instance.rotation[1] * 180) / Math.PI).toFixed(0)}°</div>

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

      {structuralResult && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: STATUS_COLORS[structuralResult.status],
                display: 'inline-block',
              }}
            />
            <span>
              Safety factor: {Number.isFinite(structuralResult.safetyFactor) ? structuralResult.safetyFactor.toFixed(2) : '∞'} ({structuralResult.status})
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
            Estimate only — not a certified structural analysis.
          </div>
        </>
      )}
    </div>
  )
}
