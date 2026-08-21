# Godot Touch Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Godot 3D scene — 2 hardcoded boards, tap-to-select
with highlight, single-finger drag-to-move with grid snap, fixed camera —
deployable to a physical Android device, so its touch feel can be
compared against the Three.js/R3F spike.

**Architecture:** A single `Node3D` root (`main.gd`) constructs the entire
scene procedurally in `_ready()` (no hand-authored `.tscn` scene content
beyond a one-line scene wrapper) — boards, ground, camera, and lighting
are all built from GDScript, mirroring how Prototype 0 built its Panda3D
scene in code rather than external assets. Grid-snap math lives in its own
`snap.gd` module (`preload()`-based, not `class_name`, to avoid any
editor-registration ordering risk) so it can be tested in isolation.
Touch input is handled via `_input(event)` on the root node, using
`Camera3D.project_ray_origin`/`project_ray_normal` for both piece-picking
(via `PhysicsRayQueryParameters3D`) and ground-plane drag math (via
Godot's built-in `Plane.intersects_ray`).

**Tech Stack:** Godot Engine 4.7.2 (GDScript), Android SDK (already
installed at `D:\Android\Sdk`).

**Spec:** [docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md](../specs/2026-08-21-platform-decision-touch-spike-design.md)

## Global Constraints

- Scope per spec: 2 hardcoded boards, tap-select with highlight,
  single-finger drag-to-move constrained to the ground plane and snapped
  to a 1" grid, one **fixed camera angle** — no orbit/pan/zoom, no
  rotation, no more than 2 boards, no piece-to-piece anchor snapping, no
  UI chrome, no save/load.
- Units are inches (matching Prototype 0's `GRID_INCREMENT = 1.0` and
  `DEFAULT_PIECES` dimensions).
- Testing on a **physical Android device** — no emulator, per the spec's
  *Device testing* section (simulated touch is a weak proxy for the thing
  being judged).
- This project is throwaway, same as Prototype 0 — don't over-invest in
  polish or architecture beyond what keeps the core interaction testable.

## Verified Environment Notes

These were confirmed by hand before writing this plan, and matter for
getting the steps below right on the first try:

- Godot Engine **4.7.2** is already installed on this machine via
  `winget install --id GodotEngine.GodotEngine --version 4.7.2`, at
  `C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe\Godot_v4.7.2-stable_win64_console.exe`.
  If it's missing in your environment, install it the same way.
- `BoxMesh.size` and `BoxShape3D.size` both take the **full** box
  dimensions (not half-extents, unlike Prototype 0's hand-built Panda3D
  mesh).
- A node created dynamically via `.new()` and added with `add_child()`
  is **not** yet `is_inside_tree()` in the same synchronous block —
  `project_ray_origin`, `project_ray_normal`, `look_at`, and
  `unproject_position` will error ("Camera is not inside scene") if
  called immediately after creating and adding a `Camera3D`. Await at
  least one frame first: `await get_tree().process_frame`.
- `Plane(normal, d).intersects_ray(from, dir)` is Godot's built-in
  ray/plane intersection — `d` is the plane's **direct** signed distance
  along `normal` from the origin (for a horizontal plane at height `Y`
  with normal `(0,1,0)`, `d = Y`, not `-Y`). Confirmed by hand: `Plane(Vector3(0,1,0), 5.0).intersects_ray(Vector3(0,20,0), Vector3(0,-1,0))`
  returns `(0, 5, 0)`.
- `PhysicsRayQueryParameters3D.create(from, to)` +
  `get_world_3d().direct_space_state.intersect_ray(query)` is the correct
  picking pattern; it returns an empty `Dictionary` on a miss and a
  `Dictionary` with a `collider` key on a hit.
- **`assert()` in a `--script`/headless runner does not exit the process
  on failure** — it aborts the current function but the `SceneTree`
  idles forever afterward since nothing calls `quit()`. A step that says
  "run this, expect a non-zero exit on failure" will instead **hang**
  if it relies on bare `assert()`. Use explicit boolean checks that call
  `quit(0)`/`quit(1)` themselves (see Task 2).
- Android SDK, NDK, build-tools, and platform-tools are already installed
  at `D:\Android\Sdk` (confirmed via `adb version` and directory listing)
  — Godot's Android export just needs to be pointed at this existing SDK,
  not install one from scratch.

---

## File Structure

```
woodcraft-prototype/
  spikes/
    touch-spike-godot/
      project.godot
      main.tscn          # one-line wrapper: root Node3D with main.gd attached
      main.gd            # scene construction + touch input + drag/snap wiring
      snap.gd            # pure grid-snap math, preload()-based module
      snap_check.gd       # headless test runner for snap.gd
      README.md
```

---

### Task 1: Godot install check + project scaffolding

**Files:**
- Create: `spikes/touch-spike-godot/project.godot`
- Create: `spikes/touch-spike-godot/main.tscn`
- Create: `spikes/touch-spike-godot/main.gd` (minimal stub — filled in by Task 3)

**Interfaces:**
- Produces: a project that Godot can open/run, with `main.tscn` as the
  entry scene. Consumed by every later task in this plan.

- [ ] **Step 1: Confirm Godot is installed**

Run (PowerShell or Bash):

```
winget list --id GodotEngine.GodotEngine
```

If it's not listed, install it:

```
winget install --id GodotEngine.GodotEngine --version 4.7.2 --accept-source-agreements --accept-package-agreements
```

Find the installed executable. In Bash:

```bash
find "/c/Users/$USER/AppData/Local/Microsoft/WinGet/Packages" -iname "*godot*console.exe"
```

In PowerShell:

```powershell
Get-ChildItem -Path "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter "*godot*console.exe"
```

At the time this plan was written, this resolved to:
`C:\Users\<user>\AppData\Local\Microsoft\WinGet\Packages\GodotEngine.GodotEngine_Microsoft.Winget.Source_8wekyb3d8bbwe\Godot_v4.7.2-stable_win64_console.exe`
(the hash-suffixed folder name may differ on another machine — always
resolve it with the command above rather than assuming this exact path).

Note this path — every later "Run: godot ..." step in this plan means
this executable. This plan refers to it as `$GODOT` below.

- [ ] **Step 2: Create the project directory and `project.godot`**

Create `spikes/touch-spike-godot/project.godot`:

```ini
; Engine configuration file.
config_version=5

[application]

config/name="touch-spike-godot"
run/main_scene="res://main.tscn"
config/features=PackedStringArray("4.3", "Forward Plus")

[rendering]

renderer/rendering_method="mobile"
```

- [ ] **Step 3: Create a minimal `main.gd` stub**

Create `spikes/touch-spike-godot/main.gd`:

```gdscript
extends Node3D

func _ready() -> void:
	print("READY_OK")
```

- [ ] **Step 4: Create `main.tscn`**

Create `spikes/touch-spike-godot/main.tscn`:

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://main.gd" id="1"]

[node name="Main" type="Node3D"]
script = ExtResource("1")
```

- [ ] **Step 5: Run it and confirm it boots**

Run (from `spikes/touch-spike-godot/`, replacing `$GODOT` with the path
from Step 1):

```
timeout 10 "$GODOT" --path . 2>&1 | grep -i "READY_OK\|SCRIPT ERROR"
```

Expected: `READY_OK` printed, no `SCRIPT ERROR` lines. (The process will
be killed by `timeout` after 10s since nothing calls `quit()` yet — that's
expected and fine here.)

- [ ] **Step 6: Commit**

```bash
git add spikes/touch-spike-godot/project.godot spikes/touch-spike-godot/main.tscn spikes/touch-spike-godot/main.gd
git commit -m "chore: scaffold Godot touch-spike project"
```

---

### Task 2: Grid-snap math module

**Files:**
- Create: `spikes/touch-spike-godot/snap.gd`
- Test: `spikes/touch-spike-godot/snap_check.gd`

**Interfaces:**
- Produces: `Snap.snap_value(value: float, increment: float) -> float`,
  loaded via `const Snap = preload("res://snap.gd")`. Consumed by Task 4
  (`main.gd`'s drag handling).

- [ ] **Step 1: Create `snap.gd`**

```gdscript
# snap.gd
extends RefCounted

static func snap_value(value: float, increment: float) -> float:
	if increment <= 0.0:
		return value
	return round(value / increment) * increment
```

- [ ] **Step 2: Create the test runner `snap_check.gd`**

```gdscript
# snap_check.gd
extends SceneTree

const Snap = preload("res://snap.gd")

func check(condition: bool, message: String) -> bool:
	if not condition:
		printerr("FAIL: ", message)
	return condition

func _initialize() -> void:
	var all_passed := true
	all_passed = check(Snap.snap_value(1.3, 1.0) == 1.0, "1.3,1.0 -> 1.0") and all_passed
	all_passed = check(Snap.snap_value(1.6, 1.0) == 2.0, "1.6,1.0 -> 2.0") and all_passed
	all_passed = check(Snap.snap_value(-1.6, 1.0) == -2.0, "-1.6,1.0 -> -2.0") and all_passed
	all_passed = check(Snap.snap_value(4.3, 0.5) == 4.5, "4.3,0.5 -> 4.5") and all_passed
	all_passed = check(Snap.snap_value(3.14159, 0.0) == 3.14159, "increment<=0 returns unchanged") and all_passed

	if all_passed:
		print("snap_check: all passed")
		quit(0)
	else:
		printerr("snap_check: FAILED")
		quit(1)
```

**Do not use bare `assert()` here** — a failed `assert()` in a
`--script` runner aborts the calling function but never exits the
process, so the run hangs instead of failing loudly (confirmed by hand).
The `check()` + explicit `quit(0)`/`quit(1)` pattern above is required to
get a real pass/fail exit code.

- [ ] **Step 3: Run it and confirm it passes**

Run: `"$GODOT" --headless --path spikes/touch-spike-godot --script snap_check.gd`
Expected: `snap_check: all passed` printed, exit code 0.

- [ ] **Step 4: Verify a failing case actually fails (sanity check the harness)**

Temporarily change one expected value to something wrong (e.g. change
`Snap.snap_value(1.3, 1.0) == 1.0` to `== 999.0`), rerun, confirm you see
`FAIL: ...` printed and a non-zero exit code, then revert the change.

- [ ] **Step 5: Commit**

```bash
git add spikes/touch-spike-godot/snap.gd spikes/touch-spike-godot/snap_check.gd
git commit -m "feat: grid snapping math for Godot spike"
```

---

### Task 3: Scene construction — boards, ground, camera, lighting

**Files:**
- Modify: `spikes/touch-spike-godot/main.gd`

**Interfaces:**
- Consumes: nothing yet from Task 2 (drag wiring comes in Task 5).
- Produces: `camera: Camera3D` (instance field), boards named `"board_a"`
  and `"board_b"` in group `"piece"`, each with a child `MeshInstance3D`
  named `"MeshInstance3D"`. Consumed by Task 4 (picking) and Task 5
  (drag).

- [ ] **Step 1: Replace `main.gd` with the full scene-construction script**

```gdscript
# main.gd
extends Node3D

var camera: Camera3D


func _ready() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-60, 45, 0)
	add_child(sun)

	var ground := MeshInstance3D.new()
	var ground_mesh := PlaneMesh.new()
	ground_mesh.size = Vector2(40, 40)
	ground.mesh = ground_mesh
	add_child(ground)

	_add_board("board_a", Vector3(1.5, 3.5, 48.0), Vector3(-6, 1.75, 0), Color(0.65, 0.45, 0.25))
	_add_board("board_b", Vector3(1.5, 3.5, 36.0), Vector3(6, 1.75, 0), Color(0.55, 0.37, 0.20))

	camera = Camera3D.new()
	add_child(camera)
	camera.position = Vector3(0, 20, 25)
	# The camera must be inside the tree before look_at()/project_ray_*
	# will work — await at least one frame after add_child().
	await get_tree().process_frame
	camera.look_at(Vector3.ZERO, Vector3.UP)

	print("READY_OK")

	if OS.get_cmdline_user_args().has("--smoke-test"):
		for i in range(3):
			await get_tree().process_frame
		var img := get_viewport().get_texture().get_image()
		img.save_png("res://smoke_test_screenshot.png")
		print("SMOKE_TEST_SCREENSHOT_SAVED")
		get_tree().quit()


func _add_board(node_name: String, size: Vector3, pos: Vector3, color: Color) -> void:
	var body := StaticBody3D.new()
	body.name = node_name
	body.add_to_group("piece")
	body.position = pos

	var collision := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	collision.shape = shape
	body.add_child(collision)

	var mesh_instance := MeshInstance3D.new()
	mesh_instance.name = "MeshInstance3D"
	var box_mesh := BoxMesh.new()
	box_mesh.size = size
	mesh_instance.mesh = box_mesh
	var material := StandardMaterial3D.new()
	material.albedo_color = color
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	add_child(body)
```

- [ ] **Step 2: Run the smoke test and confirm a screenshot is produced**

Run (from `spikes/touch-spike-godot/`):

```
"$GODOT" --path . -- --smoke-test 2>&1 | grep -i "READY_OK\|SMOKE_TEST_SCREENSHOT_SAVED\|SCRIPT ERROR"
```

Expected: `READY_OK` then `SMOKE_TEST_SCREENSHOT_SAVED` printed, no
`SCRIPT ERROR` lines, and `smoke_test_screenshot.png` exists in the
project directory afterward. Open the screenshot and confirm it shows two
tan/brown boards resting on a gray ground plane, viewed from an elevated
angle.

Delete the screenshot afterward — it's a manual-check artifact, not
something to commit:

```
rm spikes/touch-spike-godot/smoke_test_screenshot.png
```

- [ ] **Step 3: Add the screenshot artifact to `.gitignore`**

Add this line to the repo's `.gitignore`:

```
spikes/touch-spike-godot/smoke_test_screenshot.png
```

- [ ] **Step 4: Commit**

```bash
git add spikes/touch-spike-godot/main.gd .gitignore
git commit -m "feat: procedural scene construction for Godot spike"
```

---

### Task 4: Tap-select with highlight

**Files:**
- Modify: `spikes/touch-spike-godot/main.gd`

**Interfaces:**
- Consumes: `camera`, boards in group `"piece"` with child
  `"MeshInstance3D"` (Task 3).
- Produces: `selected_body: StaticBody3D` (instance field, null when
  nothing selected), `_pick_piece(screen_pos: Vector2) -> StaticBody3D`
  (returns null on a miss). Consumed by Task 5 (drag needs to know which
  piece is selected).

This task's touch behavior is manually verified — same reasoning as
Prototype 0's Tasks 8-9: it depends on live touch input this environment
cannot simulate. The picking *math* itself is verified with a synthetic
screen-coordinate call in Step 3, since that doesn't require real input.

- [ ] **Step 1: Add selection state and the `_input` handler**

Add these fields at the top of the `Node3D` class in `main.gd`, alongside
`var camera: Camera3D`:

```gdscript
var selected_body: StaticBody3D = null
```

Add this method:

```gdscript
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch and event.pressed:
		var picked := _pick_piece(event.position)
		_select(picked)
```

- [ ] **Step 2: Add `_pick_piece` and `_select`**

```gdscript
func _pick_piece(screen_pos: Vector2) -> StaticBody3D:
	var ray_origin := camera.project_ray_origin(screen_pos)
	var ray_dir := camera.project_ray_normal(screen_pos)
	var space_state := get_world_3d().direct_space_state
	var query := PhysicsRayQueryParameters3D.create(ray_origin, ray_origin + ray_dir * 1000.0)
	var result := space_state.intersect_ray(query)
	if result and result.collider is StaticBody3D and result.collider.is_in_group("piece"):
		return result.collider
	return null


func _select(body: StaticBody3D) -> void:
	if selected_body != null:
		var prev_mesh := selected_body.get_node("MeshInstance3D") as MeshInstance3D
		prev_mesh.material_override = prev_mesh.get_meta("base_material")
	selected_body = body
	if selected_body != null:
		var mesh_instance := selected_body.get_node("MeshInstance3D") as MeshInstance3D
		if not mesh_instance.has_meta("base_material"):
			mesh_instance.set_meta("base_material", mesh_instance.material_override)
		var highlight := StandardMaterial3D.new()
		highlight.albedo_color = Color(1.0, 0.7, 0.2)
		mesh_instance.material_override = highlight
```

(`set_meta`/`get_meta` stash each board's original material the first
time it's selected, so deselecting restores its original color instead of
going blank.)

- [ ] **Step 3: Verify the picking math with a synthetic screen-coordinate call**

Temporarily add this to the end of `_ready()`, after the existing
`print("READY_OK")` line and before the `--smoke-test` block:

```gdscript
	for i in range(5):
		await get_tree().process_frame
	var board_a := get_node("board_a") as StaticBody3D
	var projected: Vector2 = camera.unproject_position(board_a.position)
	var picked := _pick_piece(projected)
	print("PICK_CHECK: ", picked.name if picked != null else "null")
	get_tree().quit()
```

Run: `"$GODOT" --path spikes/touch-spike-godot 2>&1 | grep -i "PICK_CHECK\|SCRIPT ERROR"`
Expected: `PICK_CHECK: board_a`

Remove this temporary verification block afterward — it was only to
confirm the picking math, not part of the shipped scene.

- [ ] **Step 4: Commit**

```bash
git add spikes/touch-spike-godot/main.gd
git commit -m "feat: tap-to-select pieces with highlight in Godot spike"
```

---

### Task 5: Drag-to-move with grid snap

**Files:**
- Modify: `spikes/touch-spike-godot/main.gd`

**Interfaces:**
- Consumes: `Snap.snap_value` (Task 2), `selected_body`/`_pick_piece`
  (Task 4).
- Produces: live drag behavior on the selected piece, snapped to a 1"
  grid, constrained to its resting height. Manually verified for touch
  feel; the underlying math is verified synthetically in Step 4, same
  approach as Task 4.

- [ ] **Step 1: Add the `Snap` import and drag-state fields**

Add near the top of `main.gd`:

```gdscript
const Snap = preload("res://snap.gd")
const GRID_INCREMENT := 1.0
```

Add alongside `var selected_body: StaticBody3D = null`:

```gdscript
var dragging := false
var drag_offset := Vector2.ZERO
var drag_plane_y := 0.0
```

- [ ] **Step 2: Update `_input` to handle touch begin/drag/end**

Replace the `_input` method from Task 4 with:

```gdscript
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_on_touch_begin(event.position)
		else:
			dragging = false
	elif event is InputEventScreenDrag:
		if dragging:
			_on_touch_drag(event.position)
```

- [ ] **Step 3: Add `_on_touch_begin`, `_on_touch_drag`, and `_ground_hit`**

```gdscript
func _on_touch_begin(screen_pos: Vector2) -> void:
	var picked := _pick_piece(screen_pos)
	_select(picked)
	if picked != null:
		dragging = true
		drag_plane_y = picked.position.y
		var hit = _ground_hit(screen_pos, drag_plane_y)
		if hit != null:
			drag_offset = Vector2(picked.position.x - hit.x, picked.position.z - hit.z)
		else:
			drag_offset = Vector2.ZERO


func _on_touch_drag(screen_pos: Vector2) -> void:
	var hit = _ground_hit(screen_pos, drag_plane_y)
	if hit == null:
		return
	var snapped_x := Snap.snap_value(hit.x + drag_offset.x, GRID_INCREMENT)
	var snapped_z := Snap.snap_value(hit.z + drag_offset.y, GRID_INCREMENT)
	selected_body.position = Vector3(snapped_x, drag_plane_y, snapped_z)


func _ground_hit(screen_pos: Vector2, plane_y: float):
	var ray_origin := camera.project_ray_origin(screen_pos)
	var ray_dir := camera.project_ray_normal(screen_pos)
	var plane := Plane(Vector3(0, 1, 0), plane_y)
	return plane.intersects_ray(ray_origin, ray_dir)
```

Note the grab-offset math in `_on_touch_begin`/`_on_touch_drag`: the
drag target is `hit + drag_offset`, not the raw ground hit — this keeps
the piece at its position relative to where it was actually touched,
rather than snapping its origin to under the finger. (This mirrors a real
bug caught and fixed in Prototype 0's equivalent Panda3D code — getting
it right here from the start avoids repeating it.)

- [ ] **Step 4: Verify the drag math with a synthetic call**

Task 4 Step 3's verification block should already be removed by this
point (its own instructions said to remove it after confirming the pick
math). Temporarily add this to the end of `_ready()`, in the same spot:

```gdscript
	for i in range(5):
		await get_tree().process_frame
	var board_a := get_node("board_a") as StaticBody3D
	var projected: Vector2 = camera.unproject_position(board_a.position)
	_on_touch_begin(projected)
	var drag_point: Vector2 = projected + Vector2(40, 0)
	_on_touch_drag(drag_point)
	print("DRAG_CHECK final pos: ", board_a.position)
	get_tree().quit()
```

Run: `"$GODOT" --path spikes/touch-spike-godot 2>&1 | grep -i "DRAG_CHECK\|SCRIPT ERROR"`
Expected: `DRAG_CHECK final pos: (X, 1.75, Z)` where X is a whole number
different from `-6` (board_a's starting X) and Y stayed at `1.75`
(board_a's resting height, unchanged).

Remove this temporary verification block afterward.

- [ ] **Step 5: Commit**

```bash
git add spikes/touch-spike-godot/main.gd
git commit -m "feat: plane-constrained drag with grid snap in Godot spike"
```

---

### Task 6: Android export configuration

**Files:**
- Create: `spikes/touch-spike-godot/export_presets.cfg` (generated by the
  Godot editor in Step 3 below — not hand-written)

**Interfaces:**
- None (build/deploy configuration, not application code).

This task is editor-driven (GUI steps), not scriptable — Godot's export
template management and Android preset configuration don't have a
reliable headless-CLI equivalent worth scripting for a one-time spike
setup.

- [ ] **Step 1: Point Godot at the existing Android SDK**

Open the Godot editor (`"$GODOT" --editor --path spikes/touch-spike-godot`).
In the editor: **Editor → Editor Settings → Export → Android**, set
**Android SDK Path** to `D:\Android\Sdk` (already installed and
confirmed working via `adb version` — no need to install a new SDK).

- [ ] **Step 2: Install Android export templates**

In the editor: **Editor → Manage Export Templates**, click **Download and
Install** for version 4.7.2 (matching the installed engine version — a
mismatched template version will fail to export). This downloads
Godot's precompiled Android export binaries.

- [ ] **Step 3: Add an Android export preset**

In the editor: **Project → Export... → Add... → Android**. Leave the
default settings (package name, min/target SDK) — this is a spike, not a
store submission. Save the project; this creates
`spikes/touch-spike-godot/export_presets.cfg`.

- [ ] **Step 4: Commit the export preset**

```bash
git add spikes/touch-spike-godot/export_presets.cfg
git commit -m "chore: configure Godot Android export preset"
```

---

### Task 7: Deploy to device and manual playtest

**Files:**
- Modify: `spikes/touch-spike-godot/README.md` (create)

**Interfaces:**
- None (documentation + manual verification).

- [ ] **Step 1: Connect the Android device**

Enable USB debugging on the device (Settings → Developer options → USB
debugging), connect via USB, and confirm it's visible:

```
adb devices
```

Expected: the device is listed (not empty, as it was during planning
since nothing was connected yet).

- [ ] **Step 2: Deploy**

In the Godot editor, with the device connected: **Project → Export... →
[Android preset] → Export Project**, save the APK, then install it:

```
adb install -r path/to/exported.apk
```

Or use Godot's **one-click deploy** (the Android device icon in the
editor's top-right run-target dropdown), which builds and installs in one
step — try this first, it's faster if it works cleanly on the first
attempt.

- [ ] **Step 3: Manual playtest on-device**

Launch the app on the device and verify:
- Two boards are visible on a ground plane from a fixed angle.
- Tapping a board highlights it (orange); tapping the other board moves
  the highlight; tapping empty space clears the highlight.
- Dragging a highlighted board with one finger moves it, snapped to
  visible 1" grid steps, without the board jumping away from your finger
  on first touch (the grab-offset fix from Task 5).
- The board stays at its resting height while dragged.

Record your subjective impression (responsiveness, snap feel, any
tap-vs-drag misfires) — this is raw material for the final decision
record once the Three.js spike is also ready to compare, per the parent
spec's *Decision method*.

- [ ] **Step 4: Write `README.md`**

Create `spikes/touch-spike-godot/README.md`:

```markdown
# Godot Touch Spike

Minimal Godot 4.7.2 scene: 2 boards, tap-to-select, single-finger
drag-to-move with 1" grid snap, fixed camera. Built to compare touch feel
against the Three.js/R3F spike — see
`docs/superpowers/specs/2026-08-21-platform-decision-touch-spike-design.md`.

## Running

Desktop (for quick iteration, not a touch-feel test):

```
"$GODOT" --path spikes/touch-spike-godot
```

Android device: open in the Godot editor, connect a device with USB
debugging enabled, use the one-click deploy button or
Project → Export... → Export Project, then `adb install -r <apk>`.

## Tests

```
"$GODOT" --headless --path spikes/touch-spike-godot --script snap_check.gd
```
```

- [ ] **Step 5: Commit**

```bash
git add spikes/touch-spike-godot/README.md
git commit -m "docs: add Godot touch-spike run instructions"
```

---

## Self-Review Notes

- **Spec coverage:** 2 hardcoded boards (Task 3), tap-select with
  highlight (Task 4), single-finger drag-to-snap constrained to the
  ground plane (Task 5), fixed camera / no orbit-pan-zoom (Task 3, never
  added), physical Android device deployment (Tasks 6-7) — all covered.
  Grid-snap math reimplemented natively per the spec (Task 2), not ported
  from Prototype 0's Python.
- **Type consistency:** `Snap.snap_value` signature (Task 2) matches its
  call sites in Task 5. `_pick_piece`/`selected_body` (Task 4) match
  their use in Task 5's `_on_touch_begin`. `camera`/board group `"piece"`
  established in Task 3 are used identically in Tasks 4-5.
- Tasks 4-5 both modify `_input` and add methods to the same `main.gd`
  class incrementally, same pattern as Prototype 0's `app.py` — the touch
  state machine only makes sense as one object's state, splitting it
  across files would add indirection with no testability benefit.
