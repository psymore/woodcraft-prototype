import { useSceneSession } from '../store/sceneSessionStore'

export function PullupKitButton() {
  const addPullupKit = useSceneSession((s) => s.addPullupKit)

  return (
    <button onClick={addPullupKit} style={{ minWidth: 44, minHeight: 44 }}>
      PULL-UP KIT
    </button>
  )
}
