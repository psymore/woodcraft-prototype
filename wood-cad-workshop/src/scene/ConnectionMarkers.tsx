import { getConnectionPoints, toWorldPoint } from '../engine'
import { useSceneSession } from '../store/sceneSessionStore'

// One small marker per active Connection, at the midpoint of its two
// (already-coincident) anchor points. Hidden during exploded view, same as
// the rotation gizmo and vertical-move handle in Piece.tsx — exploded view
// means "pulled apart," so a joint marker sitting there would misread.
export function ConnectionMarkers() {
  const instances = useSceneSession((s) => s.instances)
  const connections = useSceneSession((s) => s.connections)
  const explodeAmount = useSceneSession((s) => s.explodeAmount)

  if (explodeAmount > 0) return null

  return (
    <>
      {connections.map((connection) => {
        const pieceA = instances.find((i) => i.id === connection.pieceAId)
        const pieceB = instances.find((i) => i.id === connection.pieceBId)
        if (!pieceA || !pieceB) return null

        const localA = getConnectionPoints(pieceA)[connection.pointAIndex]
        const localB = getConnectionPoints(pieceB)[connection.pointBIndex]
        if (!localA || !localB) return null

        const worldA = toWorldPoint(pieceA, localA)
        const worldB = toWorldPoint(pieceB, localB)
        const midpoint: [number, number, number] = [
          (worldA[0] + worldB[0]) / 2,
          (worldA[1] + worldB[1]) / 2,
          (worldA[2] + worldB[2]) / 2,
        ]

        return (
          <mesh key={connection.id} position={midpoint}>
            <sphereGeometry args={[0.3, 12, 12]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
        )
      })}
    </>
  )
}
