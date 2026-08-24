import { useSceneSession } from '../store/sceneSessionStore'

export function PullupKitButton() {
  const addPullupKit = useSceneSession((s) => s.addPullupKit)

  return (
    <button
      onClick={addPullupKit}
      style={{ position: 'absolute', bottom: 8, right: 146, minWidth: 44, minHeight: 44, zIndex: 1 }}
    >
      PULL-UP KIT
    </button>
  )
}
