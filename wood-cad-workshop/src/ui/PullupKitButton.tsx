import { useSceneSession } from '../store/sceneSessionStore'
import { panelButtonStyle } from './buttonStyle'

export function PullupKitButton() {
  const addPullupKit = useSceneSession((s) => s.addPullupKit)

  return (
    <button onClick={addPullupKit} style={panelButtonStyle()}>
      PULL-UP KIT
    </button>
  )
}
