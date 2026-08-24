import type { ComponentDefinition, ComponentInstance, Dimensions } from './component'

export function Inspector({
  instance,
  definition,
  onChangeDimensions,
}: {
  instance: ComponentInstance | null
  definition: ComponentDefinition | null
  onChangeDimensions: (id: string, dimensions: Dimensions) => void
}) {
  if (!instance || !definition) return null

  const setDimension = (key: string, value: number) => {
    if (Number.isNaN(value)) return
    onChangeDimensions(instance.id, { ...instance.dimensions, [key]: value })
  }

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        marginTop: 140,
        width: 200,
        background: 'rgba(255,255,255,0.96)',
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 10,
        zIndex: 1,
        fontSize: 13,
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: 6 }}>{definition.name}</div>

      <div style={{ fontWeight: 'bold', marginTop: 6 }}>Dimensions</div>
      {Object.entries(instance.dimensions).map(([key, value]) => (
        <label key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
          <span style={{ textTransform: 'capitalize' }}>{key}</span>
          <input
            type="number"
            value={value}
            onChange={(e) => setDimension(key, e.target.valueAsNumber)}
            style={{ width: 80, minHeight: 32 }}
          />
        </label>
      ))}

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Position</div>
      <div>
        x: {instance.position[0].toFixed(2)}, y: {instance.position[1].toFixed(2)}, z: {instance.position[2].toFixed(2)}
      </div>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Rotation</div>
      <div>yaw: {((instance.rotation[1] * 180) / Math.PI).toFixed(0)}°</div>

      <div style={{ fontWeight: 'bold', marginTop: 8 }}>Material</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 16, height: 16, background: instance.material, border: '1px solid #999', display: 'inline-block' }} />
        {instance.material}
      </div>
    </div>
  )
}
