import { Dumbbell } from 'lucide-react'
import { useSceneSession } from '../store/sceneSessionStore'
import { MenuButton } from './MenuButton'

export function PullupKitButton({ showLabels }: { showLabels: boolean }) {
  const addPullupKit = useSceneSession((s) => s.addPullupKit)

  return <MenuButton icon={<Dumbbell size={18} />} label="Pull-Up Kit" showLabels={showLabels} onClick={addPullupKit} />
}
