import { Dumbbell, Wrench } from 'lucide-react'
import { useSceneSession } from '../store/sceneSessionStore'
import { MenuButton } from './MenuButton'

// Two ways to add the same 5-piece kit (bar + 2 posts + 2 feet): loose
// (addPullupKit — pieces land unconnected, for anyone who wants to
// practice the drag-to-snap flow) or pre-assembled (addAssembledPullupKit
// — same pieces, already positioned and connected, for anyone who just
// wants a standing pull-up bar to work with immediately).
export function PullupKitButton({ showLabels }: { showLabels: boolean }) {
  const addPullupKit = useSceneSession((s) => s.addPullupKit)
  const addAssembledPullupKit = useSceneSession((s) => s.addAssembledPullupKit)

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <MenuButton icon={<Dumbbell size={18} />} label="Pull-Up Kit" showLabels={showLabels} onClick={addPullupKit} />
      <MenuButton
        icon={<Wrench size={18} />}
        label="Pull-Up Kit (Assembled)"
        showLabels={showLabels}
        onClick={addAssembledPullupKit}
      />
    </div>
  )
}
