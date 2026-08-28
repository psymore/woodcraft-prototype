# Connected-Piece Rigid Group Movement

Status: implemented.

## Context

This is a direct follow-up to the part-joining/connection system
([2026-08-26-part-joining-system-design.md](2026-08-26-part-joining-system-design.md)),
picking up the first of the four follow-ups that document's "Explicitly out
of scope" section deferred: "moving connected pieces together (rigid group
movement — a separate future feature)."

Today, `Connection` records (`engine/core/types.ts`) exist purely as a
soft, breakable relationship: two pieces' anchor points snap together when
dragged close and the connection is dropped (`pruneStaleConnections`) once
either piece moves far enough away — including when the piece that moved
is the one you're dragging. Dragging one board of a two-board assembly
today leaves the other board behind. This spec adds rigid movement: drag
any piece, and every piece transitively reachable through the connection
graph moves with it, preserving relative position exactly.

## Naming note

This is *not* the product design doc's `Group` concept (an explicit,
user-created, one-level-deep collection for organizational multi-select,
unrelated to physical contact). This feature computes its "moves
together" set on the fly from the `Connection` graph — there is no new
persisted entity, no group id, no group/ungroup action. If the design
doc's `Group` is ever built, it is a separate feature with a separate
spec.

## Explicitly out of scope for this step

- **Rigid rotation.** Rotating a piece (the gizmo, the ROTATE button) does
  not rotate its connected assembly around a pivot — it continues to
  affect only that piece, and `pruneStaleConnections` (already wired in
  from the part-joining system) breaks the connection if the rotation
  moves the anchor points out of range, exactly as it does today. Full
  rigid-body rotation (choosing a pivot, recomputing every member's
  position *and* orientation) is materially more complex and is not
  needed to satisfy "dragging pieces moves them together."
- **Stand Up, resize.** Both continue to affect only the single piece they
  target, with the existing post-action pruning unchanged. Neither is a
  drag gesture, and extending them to carry a connected assembly along
  was not requested.
- **Group-aware new-connection search.** While dragging, only the grabbed
  piece's own anchor points are searched for a new match — other pieces
  riding along in the same rigid move do not also search for connections
  to make. Keeps the search scope identical to today's (one piece), just
  layered under the new group-translation step.

## Design

### `getConnectedPieceIds` (pure, `engine/core/connections.ts`)

```ts
export function getConnectedPieceIds(pieceId: string, connections: Connection[]): Set<string>
```

Breadth-first traversal of the connection graph (treating each
`Connection` as an undirected edge between `pieceAId` and `pieceBId`)
starting from `pieceId`. Returns the full connected component, *including*
`pieceId` itself — visited-set-guarded, so a cycle in the connection graph
(e.g. three pieces connected in a triangle) terminates normally instead of
looping.

### `movePiece` extension (`store/sceneSessionStore.ts`)

Everything `movePiece` already does — the pre-snap prune, the new-match
search restricted to the dragged piece, computing `finalPosition` — is
unchanged. Two steps are added after `finalPosition` is known, before the
final `instances` map is built:

1. Compute this call's actual displacement of the dragged piece:
   `delta = finalPosition − movingInstance.position` (component-wise).
   This is the *real* displacement including any snap correction, not the
   raw proposed position — so a group rides along exactly as far as the
   dragged piece itself actually moved.
2. Call `getConnectedPieceIds(id, state.connections)` — the *current*,
   pre-move connection topology, not a distance-filtered intermediate
   snapshot — to get the rigid move set. For every instance in that set
   other than `id` itself, add `delta` to its stored position unchanged.
   `id` itself gets `finalPosition` directly, as today.

   An earlier version derived group membership from a position-filtered
   snapshot taken before any group member had moved; any drag delta larger
   than `SNAP_DISTANCE` could then spuriously exclude a genuinely connected
   piece from the move (found and fixed during implementation review).
   Deriving membership from the raw connection graph instead is correct
   because a uniform translation can never change two connected pieces'
   relative distance — group membership doesn't depend on current
   proximity, only on connection topology.

   The new-connection search (`findClosestConnectionMatch`) also excludes
   every one of the dragged piece's own group members from its candidate
   list, not just the dragged piece itself. Without this, a drag that
   brings two already-connected-via-the-group pieces' free ends near each
   other (e.g. closing a loop) would try to form a spurious new connection
   between them at their stale pre-move positions — a rigid translation
   can never change a group member's distance to another group member, so
   such a match could never be a legitimate new connection anyway.

Because every group member receives the *same* delta, their relative
offsets — and therefore their existing connections to each other — are
preserved exactly. The post-move `pruneStaleConnections` pass (unchanged)
is consequently a defensive/invariant check here, not the mechanism that
decides group membership: every group-internal connection is
translation-invariant by construction (both endpoints moved by the
identical delta), so in practice this pass never removes anything for a
pure translation. (A connection to a piece genuinely outside the moving
group is impossible by definition — connected components are closed under
the connection relation, so any piece connected to a group member is
already a member of that group.)

This applies uniformly to every caller of `movePiece` — both the body
drag handler and the vertical-move handle in `Piece.tsx` — with no
special-casing, since both already funnel through this one action.

## Testing

`getConnectedPieceIds` is pure `engine/core` logic — new unit coverage in
`connections.test.ts`: a simple two-piece chain, a longer A-B-C-D chain
(confirming transitivity), a branching case (one piece connected to two
others), and a cycle (confirming it terminates and returns the correct
set, not an infinite loop).

`movePiece`'s new group-translation step is store orchestration, which
this project's established convention normally leaves untested (pure
`engine/core` functions get tests, Zustand store actions do not). This
step is a scoped exception: it produced two distinct bugs during
development (a stranded-neighbor bug from deriving group membership off a
stale snapshot, and the near-closed-loop stale-position self-match
described above) in the same ~15 lines, so `store/sceneSessionStore.test.ts`
covers it directly via `createSceneSessionStore()` — a connected pair
moving together with their connection intact, the near-closed-loop case
forming no spurious connection and preserving group offsets exactly, and
an unconnected piece's drag leaving every other instance
reference-identical.

## Manual verification (user, after implementation)

1. Connect two boards end-to-end, then drag one — the other should move
   with it, maintaining the same relative offset and connection marker.
2. Build a 3+ piece chain (e.g. board–board–board, each end-connected to
   the next) and drag one end piece — the whole chain should move
   together.
3. Build the pull-up kit (bar connected to both posts) and drag the bar —
   both posts should move with it.
4. Rotate one piece in a connected pair — only that piece should rotate;
   the connection should break (marker disappears) rather than the group
   rotating together, matching existing rotate-breaks-connection behavior.
5. Drag a piece that is connected to a chain, close enough to a *third*,
   unconnected piece to form a new connection — the new connection should
   form correctly and the rest of the dragged chain should still have
   moved together.
6. Use the vertical-move handle (not just horizontal drag) on a connected
   piece — its connected assembly should rise/fall with it too.
7. Build a near-closed loop (e.g. four boards forming a rectangle, three
   joints connected) and drag one board to bring the last two free ends
   together — the loop should close cleanly with a real new connection,
   not a stray gap-holding connection at the old positions.
