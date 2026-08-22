# Wood CAD Workshop — Foundation (Godot) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera/view system, an engine-agnostic component data model, and a minimal view-control bar to `spikes/touch-spike-godot/`, while migrating the two existing hardcoded boards onto the new data model without regressing tap-select/drag-move.

**Architecture:** New rendering-free GDScript modules (`component_definition.gd`, `component_instance.gd`, `components.gd`, `camera_orbit.gd`, `view_presets.gd`) hold data/math, loaded via `preload()` (matching the existing `snap.gd` convention, which deliberately avoids `class_name` to sidestep editor class-registration ordering risk) and verified with headless `SceneTree`-script checks (matching the existing `snap_check.gd` pattern — there is no unit-test framework installed, so this is the established convention to follow). `main.gd`'s `_input` is extended to track multiple simultaneous touches by index, so a single finger on empty space orbits, a single finger on a piece drags it (existing behavior, unchanged), and two fingers pan/zoom the camera. Unlike the Three.js side (which reuses `@react-three/drei`'s `OrbitControls`), Godot has no built-in orbit-camera addon, so the orbit/pan/zoom interaction itself is hand-rolled here — this asymmetry in implementation effort is itself relevant data for the engine comparison, not a bug to paper over.

**Tech Stack:** Godot Engine 4.7.2, GDScript. No addons added.

**Spec:** `docs/superpowers/specs/2026-08-22-wood-cad-workshop-design.md` (Sub-project 1 — Foundation)

## Global Constraints

- One-finger drag on empty space = orbit; two-finger drag = pan; pinch = zoom; tap a piece = select; tap empty space = deselect. Object-drag and camera-drag must never both fire from the same gesture.
- Coordinate system is Y = up, X = left/right, Z = depth (already the case in this codebase).
- Geometry is procedural from dimensions — never swap meshes/assets when dimensions change.
- `ComponentDefinition`'s connection points, structural properties, and explode direction exist on the type but are not computed or consumed this phase (empty array / empty dictionary / `null`).
- No shared runtime/source between the Three.js and Godot implementations — same concepts, native code in each.
- Existing `snap.gd`, the grid, and the tap-select/drag-move interaction must keep working exactly as before (regression check).
- Follow the existing flat project layout — no new subdirectories.
- `pointing/emulate_touch_from_mouse=true` (already set in `project.godot`) means desktop mouse testing only ever produces a single synthesized touch (index 0) — two-finger pan/pinch-zoom cannot be verified on desktop and must be checked on a physical device or the Android emulator.

---

### Task 1: Component data model

**Files:**
- Create: `spikes/touch-spike-godot/component_definition.gd`
- Create: `spikes/touch-spike-godot/component_instance.gd`
- Create: `spikes/touch-spike-godot/components.gd`
- Test: `spikes/touch-spike-godot/component_check.gd`

**Interfaces:**
- Consumes: nothing (leaf modules).
- Produces: `ComponentDefinition` (fields: `id`, `component_name`, `category`, `geometry_shape`, `default_dimensions`, `material`, `connection_points`, `structural_properties`, `explode_direction`); `ComponentInstance` (fields: `id`, `component_definition_id`, `position`, `rotation`, `dimensions`, `material`); `Components.board_definition() -> ComponentDefinition`, `Components.initial_board_instances() -> Array`, `Components.box_size(instance) -> Vector3` — all consumed by Task 2.

- [ ] **Step 1: Write `component_definition.gd`**

```gdscript
# component_definition.gd
extends RefCounted

var id: String
var component_name: String
var category: String  # "WOOD" | "HARDWARE" | "FASTENER"
var geometry_shape: String  # "box" | "cylinder"
var default_dimensions: Dictionary
var material: Color
var connection_points: Array
var structural_properties: Dictionary
var explode_direction  # Vector3 once used; null (reserved, unused this phase)

func _init(p_id: String, p_component_name: String, p_category: String, p_geometry_shape: String, p_default_dimensions: Dictionary, p_material: Color) -> void:
	id = p_id
	component_name = p_component_name
	category = p_category
	geometry_shape = p_geometry_shape
	default_dimensions = p_default_dimensions
	material = p_material
	connection_points = []
	structural_properties = {}
	explode_direction = null
```

- [ ] **Step 2: Write `component_instance.gd`**

```gdscript
# component_instance.gd
extends RefCounted

var id: String
var component_definition_id: String
var position: Vector3
var rotation: Vector3
var dimensions: Dictionary
var material: Color

func _init(p_id: String, p_component_definition_id: String, p_position: Vector3, p_dimensions: Dictionary, p_material: Color, p_rotation: Vector3 = Vector3.ZERO) -> void:
	id = p_id
	component_definition_id = p_component_definition_id
	position = p_position
	rotation = p_rotation
	dimensions = p_dimensions
	material = p_material
```

- [ ] **Step 3: Write `components.gd`**

```gdscript
# components.gd
extends RefCounted

const ComponentDefinition = preload("res://component_definition.gd")
const ComponentInstance = preload("res://component_instance.gd")

static func board_definition() -> ComponentDefinition:
	return ComponentDefinition.new(
		"board", "Board", "WOOD", "box",
		{"thickness": 1.5, "width": 3.5, "length": 48.0},
		Color(0.65, 0.45, 0.25)
	)

static func initial_board_instances() -> Array:
	return [
		ComponentInstance.new(
			"board_a", "board", Vector3(-6, 1.75, 0),
			{"thickness": 1.5, "width": 3.5, "length": 48.0},
			Color(0.65, 0.45, 0.25)
		),
		ComponentInstance.new(
			"board_b", "board", Vector3(6, 1.75, 0),
			{"thickness": 1.5, "width": 3.5, "length": 36.0},
			Color(0.55, 0.37, 0.20)
		),
	]

static func box_size(instance: ComponentInstance) -> Vector3:
	return Vector3(
		instance.dimensions.get("thickness", 1.0),
		instance.dimensions.get("width", 1.0),
		instance.dimensions.get("length", 1.0)
	)
```

- [ ] **Step 4: Write the headless check script**

```gdscript
# component_check.gd
extends SceneTree

const Components = preload("res://components.gd")

func check(condition: bool, message: String) -> bool:
	if not condition:
		printerr("FAIL: ", message)
	return condition

func _initialize() -> void:
	var all_passed := true

	var board_def := Components.board_definition()
	all_passed = check(board_def.category == "WOOD", "board_definition category is WOOD") and all_passed
	all_passed = check(board_def.geometry_shape == "box", "board_definition geometry_shape is box") and all_passed
	all_passed = check(board_def.default_dimensions == {"thickness": 1.5, "width": 3.5, "length": 48.0}, "board_definition default_dimensions") and all_passed
	all_passed = check(board_def.connection_points == [], "board_definition connection_points starts empty") and all_passed
	all_passed = check(board_def.structural_properties == {}, "board_definition structural_properties starts empty") and all_passed
	all_passed = check(board_def.explode_direction == null, "board_definition explode_direction starts null") and all_passed

	var instances := Components.initial_board_instances()
	all_passed = check(instances.size() == 2, "initial_board_instances has 2 entries") and all_passed
	all_passed = check(instances[0].id == "board_a", "instance 0 id is board_a") and all_passed
	all_passed = check(instances[0].position == Vector3(-6, 1.75, 0), "instance 0 position matches existing board_a") and all_passed
	all_passed = check(instances[1].id == "board_b", "instance 1 id is board_b") and all_passed
	all_passed = check(instances[1].position == Vector3(6, 1.75, 0), "instance 1 position matches existing board_b") and all_passed

	all_passed = check(Components.box_size(instances[0]) == Vector3(1.5, 3.5, 48.0), "box_size(board_a) matches existing BoxShape3D size") and all_passed
	all_passed = check(Components.box_size(instances[1]) == Vector3(1.5, 3.5, 36.0), "box_size(board_b) matches existing BoxShape3D size") and all_passed

	if all_passed:
		print("component_check: all passed")
		quit(0)
	else:
		printerr("component_check: FAILED")
		quit(1)
```

- [ ] **Step 5: Run the check and verify it fails first, for the wrong reason if files are missing, then passes**

Run: `"$GODOT" --headless --path spikes/touch-spike-godot --script component_check.gd`
(Replace `$GODOT` with the Godot 4.7.2 executable path used elsewhere in this repo, e.g. as run in `spikes/touch-spike-godot/README.md`.)
Expected before Steps 1-3 exist: FAIL to parse (`Could not resolve script "res://components.gd"`). After Steps 1-4: `component_check: all passed`, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add spikes/touch-spike-godot/component_definition.gd spikes/touch-spike-godot/component_instance.gd spikes/touch-spike-godot/components.gd spikes/touch-spike-godot/component_check.gd
git commit -m "feat(godot-spike): add ComponentDefinition/ComponentInstance data model"
```

---

### Task 2: Migrate board construction to the component model

**Files:**
- Modify: `spikes/touch-spike-godot/main.gd`

**Interfaces:**
- Consumes: `Components.board_definition()`, `Components.initial_board_instances()`, `Components.box_size()` from Task 1.
- Produces: `_add_piece(instance, definition)` replacing `_add_board(...)`, consumed by Task 4's Frame All (via the existing `"piece"` group, unchanged).

- [ ] **Step 1: Replace `_add_board` with `_add_piece` and update `_ready()`**

```gdscript
# main.gd — add near the top, after the existing `const Snap := preload("res://snap.gd")`
const Components = preload("res://components.gd")
```

```gdscript
# main.gd — replace the two _add_board(...) calls in _ready() with:
	var board_definition := Components.board_definition()
	for instance in Components.initial_board_instances():
		_add_piece(instance, board_definition)
```

```gdscript
# main.gd — replace the _add_board function with:
func _add_piece(instance, definition) -> void:
	var body := StaticBody3D.new()
	body.name = instance.id
	body.add_to_group("piece")
	body.position = instance.position

	var size: Vector3 = Components.box_size(instance)

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
	material.albedo_color = instance.material
	mesh_instance.material_override = material
	body.add_child(mesh_instance)

	add_child(body)
```

- [ ] **Step 2: Run the existing checks**

Run: `"$GODOT" --headless --path spikes/touch-spike-godot --script snap_check.gd && "$GODOT" --headless --path spikes/touch-spike-godot --script component_check.gd`
Expected: both print `all passed` and exit 0 (this task doesn't change either module's behavior, just how `main.gd` constructs pieces from them).

- [ ] **Step 3: Manual regression check**

Run: `"$GODOT" --path spikes/touch-spike-godot` (desktop run).
Verify: two boards render at the same positions/sizes/colors as before (`board_a` on the left, `board_b` on the right); clicking a board highlights it orange; dragging a selected board moves it snapped to the 1" grid; clicking empty space deselects. This must look and behave identically to before this task.

- [ ] **Step 4: Commit**

```bash
git add spikes/touch-spike-godot/main.gd
git commit -m "refactor(godot-spike): migrate boards onto ComponentDefinition/ComponentInstance model"
```

---

### Task 3: Camera orbit math and view presets (pure modules)

**Files:**
- Create: `spikes/touch-spike-godot/camera_orbit.gd`
- Create: `spikes/touch-spike-godot/view_presets.gd`
- Test: `spikes/touch-spike-godot/camera_orbit_check.gd`

**Interfaces:**
- Consumes: nothing.
- Produces: `CameraOrbit.clamp_polar`, `CameraOrbit.clamp_radius`, `CameraOrbit.orbit_to_position`, `CameraOrbit.position_to_orbit`, `CameraOrbit.compute_bounds`; `ViewPresets.preset(view_name: String) -> Dictionary` — all consumed by Task 4.

- [ ] **Step 1: Write `camera_orbit.gd`**

```gdscript
# camera_orbit.gd
extends RefCounted

const MIN_POLAR := 0.05
const MAX_POLAR := PI - 0.05
const MIN_RADIUS := 5.0
const MAX_RADIUS := 200.0

static func clamp_polar(polar: float) -> float:
	return clampf(polar, MIN_POLAR, MAX_POLAR)

static func clamp_radius(radius: float) -> float:
	return clampf(radius, MIN_RADIUS, MAX_RADIUS)

static func orbit_to_position(target: Vector3, azimuth: float, polar: float, radius: float) -> Vector3:
	var sin_polar := sin(polar)
	var x := target.x + radius * sin_polar * sin(azimuth)
	var y := target.y + radius * cos(polar)
	var z := target.z + radius * sin_polar * cos(azimuth)
	return Vector3(x, y, z)

static func position_to_orbit(position: Vector3, target: Vector3) -> Dictionary:
	var offset := position - target
	var radius := offset.length()
	var polar := acos(offset.y / radius) if radius > 0.0 else 0.0
	var azimuth := atan2(offset.x, offset.z)
	return {"azimuth": azimuth, "polar": polar, "radius": radius}

static func compute_bounds(positions: Array) -> Dictionary:
	if positions.is_empty():
		return {"center": Vector3.ZERO, "radius": 10.0}
	var center := Vector3.ZERO
	for p in positions:
		center += p
	center /= positions.size()
	var radius := 1.0
	for p in positions:
		radius = max(radius, center.distance_to(p))
	return {"center": center, "radius": radius}
```

- [ ] **Step 2: Write `view_presets.gd`**

```gdscript
# view_presets.gd
extends RefCounted

const DISTANCE := 32.0

static func preset(view_name: String) -> Dictionary:
	match view_name:
		"3d":
			return {"position": Vector3(0, 20, 25), "up": Vector3(0, 1, 0)}
		"front":
			return {"position": Vector3(0, 0, DISTANCE), "up": Vector3(0, 1, 0)}
		"back":
			return {"position": Vector3(0, 0, -DISTANCE), "up": Vector3(0, 1, 0)}
		"left":
			return {"position": Vector3(-DISTANCE, 0, 0), "up": Vector3(0, 1, 0)}
		"right":
			return {"position": Vector3(DISTANCE, 0, 0), "up": Vector3(0, 1, 0)}
		"top":
			return {"position": Vector3(0, DISTANCE, 0), "up": Vector3(0, 0, -1)}
		"bottom":
			return {"position": Vector3(0, -DISTANCE, 0), "up": Vector3(0, 0, 1)}
		_:
			return {"position": Vector3(0, 20, 25), "up": Vector3(0, 1, 0)}

static func view_names() -> Array:
	return ["3d", "front", "back", "left", "right", "top", "bottom"]
```

- [ ] **Step 3: Write the headless check script**

```gdscript
# camera_orbit_check.gd
extends SceneTree

const CameraOrbit = preload("res://camera_orbit.gd")
const ViewPresets = preload("res://view_presets.gd")

func check(condition: bool, message: String) -> bool:
	if not condition:
		printerr("FAIL: ", message)
	return condition

func vec3_close(a: Vector3, b: Vector3, eps: float = 0.001) -> bool:
	return a.distance_to(b) < eps

func _initialize() -> void:
	var all_passed := true

	all_passed = check(CameraOrbit.clamp_polar(-1.0) == CameraOrbit.MIN_POLAR, "clamp_polar floors at MIN_POLAR") and all_passed
	all_passed = check(CameraOrbit.clamp_polar(10.0) == CameraOrbit.MAX_POLAR, "clamp_polar ceils at MAX_POLAR") and all_passed
	all_passed = check(CameraOrbit.clamp_radius(1.0) == CameraOrbit.MIN_RADIUS, "clamp_radius floors at MIN_RADIUS") and all_passed
	all_passed = check(CameraOrbit.clamp_radius(1000.0) == CameraOrbit.MAX_RADIUS, "clamp_radius ceils at MAX_RADIUS") and all_passed

	var pos := CameraOrbit.orbit_to_position(Vector3.ZERO, 0.0, PI / 2.0, 10.0)
	all_passed = check(vec3_close(pos, Vector3(0, 0, 10)), "orbit_to_position(azimuth=0, polar=90deg) faces +Z") and all_passed

	var orbit := CameraOrbit.position_to_orbit(Vector3(0, 20, 25), Vector3.ZERO)
	var round_trip := CameraOrbit.orbit_to_position(Vector3.ZERO, orbit.azimuth, orbit.polar, orbit.radius)
	all_passed = check(vec3_close(round_trip, Vector3(0, 20, 25)), "position_to_orbit/orbit_to_position round-trip the current fixed camera position") and all_passed

	var bounds := CameraOrbit.compute_bounds([Vector3(-6, 1.75, 0), Vector3(6, 1.75, 0)])
	all_passed = check(vec3_close(bounds.center, Vector3(0, 1.75, 0)), "compute_bounds centers on the two boards") and all_passed
	all_passed = check(absf(bounds.radius - 6.0) < 0.001, "compute_bounds radius is the max distance from center") and all_passed

	var top_preset := ViewPresets.preset("top")
	all_passed = check(top_preset.position == Vector3(0, ViewPresets.DISTANCE, 0), "top preset looks straight down") and all_passed
	all_passed = check(top_preset.up == Vector3(0, 0, -1), "top preset uses an alternate up vector to avoid gimbal lock") and all_passed
	all_passed = check(ViewPresets.view_names().size() == 7, "view_names lists all 7 presets") and all_passed

	if all_passed:
		print("camera_orbit_check: all passed")
		quit(0)
	else:
		printerr("camera_orbit_check: FAILED")
		quit(1)
```

- [ ] **Step 4: Run the check**

Run: `"$GODOT" --headless --path spikes/touch-spike-godot --script camera_orbit_check.gd`
Expected: `camera_orbit_check: all passed`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add spikes/touch-spike-godot/camera_orbit.gd spikes/touch-spike-godot/view_presets.gd spikes/touch-spike-godot/camera_orbit_check.gd
git commit -m "feat(godot-spike): add pure camera orbit/view-preset/frame-bounds math"
```

---

### Task 4: Wire multi-touch orbit/pan/zoom and the view-control bar

**Files:**
- Modify: `spikes/touch-spike-godot/main.gd`

**Interfaces:**
- Consumes: `CameraOrbit.*` and `ViewPresets.*` from Task 3.
- Produces: nothing consumed by later tasks in this plan (this is the top-level wiring).

This task is engine wiring (input handling + procedurally-built UI) that isn't meaningfully unit-testable — verification is manual, per the spec's own testing section. `main.gd`'s `_input`, `_ready()`, `_select()`, and state variables all change; the full replacement content is given below rather than a diff, since the changes are pervasive.

- [ ] **Step 1: Replace the top-of-file state and add the new preloads**

```gdscript
# main.gd — replace the const/var block at the top with:
const Snap = preload("res://snap.gd")
const Components = preload("res://components.gd")
const CameraOrbit = preload("res://camera_orbit.gd")
const ViewPresets = preload("res://view_presets.gd")
const GRID_INCREMENT := 1.0
const GRID_EXTENT := 60.0  # inches, half-width of the drawn ground grid
const ORBIT_SPEED := 0.01
const PAN_SPEED := 0.05
const ZOOM_SPEED := 0.02

var camera: Camera3D
var selected_body: StaticBody3D = null
var dragging := false
var drag_offset := Vector2.ZERO
var drag_plane_y := 0.0

var orbit_target := Vector3.ZERO
var orbit_azimuth := 0.0
var orbit_polar := 0.0
var orbit_radius := 0.0
var camera_up := Vector3.UP
var active_touches: Dictionary = {}
var camera_mode := ""  # "" | "orbit" | "pan_zoom"
var pan_zoom_prev_midpoint := Vector2.ZERO
var pan_zoom_prev_distance := 0.0
var frame_selected_button: Button
```

- [ ] **Step 2: Replace `_input` with multi-touch tracking**

```gdscript
func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			active_touches[event.index] = event.position
			_on_touch_begin(event.index, event.position)
		else:
			active_touches.erase(event.index)
			_on_touch_end(event.index)
	elif event is InputEventScreenDrag:
		active_touches[event.index] = event.position
		_on_touch_drag(event.index, event.position, event.relative)
```

- [ ] **Step 3: Add the gesture-dispatch functions**

```gdscript
func _on_touch_begin(index: int, screen_pos: Vector2) -> void:
	if index == 0 and active_touches.size() == 1:
		var picked := _pick_piece(screen_pos)
		_select(picked)
		if picked != null:
			dragging = true
			camera_mode = ""
			drag_plane_y = picked.position.y
			var hit = _ground_hit(screen_pos, drag_plane_y)
			drag_offset = Vector2(picked.position.x - hit.x, picked.position.z - hit.z) if hit != null else Vector2.ZERO
		else:
			dragging = false
			camera_mode = "orbit"
			camera_up = Vector3.UP
	elif active_touches.size() == 2:
		dragging = false
		camera_mode = "pan_zoom"
		var positions := active_touches.values()
		pan_zoom_prev_midpoint = (positions[0] + positions[1]) / 2.0
		pan_zoom_prev_distance = positions[0].distance_to(positions[1])


func _on_touch_end(index: int) -> void:
	dragging = false
	if active_touches.size() == 1:
		camera_mode = "orbit"
	elif active_touches.is_empty():
		camera_mode = ""


func _on_touch_drag(index: int, screen_pos: Vector2, relative: Vector2) -> void:
	if dragging and index == 0:
		_on_piece_drag(screen_pos)
	elif camera_mode == "orbit" and active_touches.size() == 1:
		_on_orbit_drag(relative)
	elif camera_mode == "pan_zoom" and active_touches.size() == 2:
		_on_pan_zoom_drag()


func _on_piece_drag(screen_pos: Vector2) -> void:
	var hit = _ground_hit(screen_pos, drag_plane_y)
	if hit == null:
		return
	var snapped_x := Snap.snap_value(hit.x + drag_offset.x, GRID_INCREMENT)
	var snapped_z := Snap.snap_value(hit.z + drag_offset.y, GRID_INCREMENT)
	selected_body.position = Vector3(snapped_x, drag_plane_y, snapped_z)


func _on_orbit_drag(relative: Vector2) -> void:
	orbit_azimuth -= relative.x * ORBIT_SPEED
	orbit_polar = CameraOrbit.clamp_polar(orbit_polar - relative.y * ORBIT_SPEED)
	_update_camera_transform()


func _on_pan_zoom_drag() -> void:
	var positions := active_touches.values()
	var midpoint: Vector2 = (positions[0] + positions[1]) / 2.0
	var distance: float = positions[0].distance_to(positions[1])

	var pan_delta := midpoint - pan_zoom_prev_midpoint
	var right := Vector3(cos(orbit_azimuth), 0, -sin(orbit_azimuth))
	orbit_target -= right * pan_delta.x * PAN_SPEED
	orbit_target.y += pan_delta.y * PAN_SPEED

	var distance_delta := distance - pan_zoom_prev_distance
	orbit_radius = CameraOrbit.clamp_radius(orbit_radius - distance_delta * ZOOM_SPEED)

	pan_zoom_prev_midpoint = midpoint
	pan_zoom_prev_distance = distance
	_update_camera_transform()


func _update_camera_transform() -> void:
	camera.position = CameraOrbit.orbit_to_position(orbit_target, orbit_azimuth, orbit_polar, orbit_radius)
	camera.look_at(orbit_target, camera_up)


func _apply_view(view_name: String) -> void:
	var preset := ViewPresets.preset(view_name)
	var orbit := CameraOrbit.position_to_orbit(preset.position, orbit_target)
	orbit_azimuth = orbit.azimuth
	orbit_polar = orbit.polar
	orbit_radius = orbit.radius
	camera_up = preset.up
	_update_camera_transform()


func _frame(positions: Array) -> void:
	if positions.is_empty():
		return
	var bounds := CameraOrbit.compute_bounds(positions)
	orbit_target = bounds.center
	orbit_radius = CameraOrbit.clamp_radius(max(bounds.radius * 2.5, 10.0))
	_update_camera_transform()


func _on_frame_all_pressed() -> void:
	var positions: Array = []
	for piece in get_tree().get_nodes_in_group("piece"):
		positions.append(piece.position)
	_frame(positions)


func _on_frame_selected_pressed() -> void:
	if selected_body != null:
		_frame([selected_body.position])
```

- [ ] **Step 4: Initialize orbit state from the existing fixed camera position in `_ready()`, and build the view bar**

```gdscript
# main.gd — in _ready(), replace the camera-setup block:
#   camera = Camera3D.new()
#   add_child(camera)
#   camera.position = Vector3(0, 20, 25)
#   await get_tree().process_frame
#   camera.look_at(Vector3.ZERO, Vector3.UP)
# with:
	camera = Camera3D.new()
	add_child(camera)
	var initial_orbit := CameraOrbit.position_to_orbit(Vector3(0, 20, 25), Vector3.ZERO)
	orbit_azimuth = initial_orbit.azimuth
	orbit_polar = initial_orbit.polar
	orbit_radius = initial_orbit.radius
	# The camera must be inside the tree before project_ray_*/look_at will work.
	await get_tree().process_frame
	_update_camera_transform()

	_build_view_bar()
```

```gdscript
# main.gd — add near the bottom, alongside the other helper functions:
func _build_view_bar() -> void:
	var canvas := CanvasLayer.new()
	add_child(canvas)
	var bar := HBoxContainer.new()
	bar.position = Vector2(8, 8)
	canvas.add_child(bar)

	for view_name in ViewPresets.view_names():
		var button := Button.new()
		button.text = view_name.to_upper()
		button.custom_minimum_size = Vector2(64, 44)
		button.pressed.connect(_apply_view.bind(view_name))
		bar.add_child(button)

	var frame_all_button := Button.new()
	frame_all_button.text = "FRAME ALL"
	frame_all_button.custom_minimum_size = Vector2(96, 44)
	frame_all_button.pressed.connect(_on_frame_all_pressed)
	bar.add_child(frame_all_button)

	frame_selected_button = Button.new()
	frame_selected_button.text = "FRAME SEL"
	frame_selected_button.custom_minimum_size = Vector2(96, 44)
	frame_selected_button.disabled = true
	frame_selected_button.pressed.connect(_on_frame_selected_pressed)
	bar.add_child(frame_selected_button)
```

- [ ] **Step 5: Update `_select()` to toggle the Frame Selected button**

```gdscript
# main.gd — replace _select() with:
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
	if frame_selected_button != null:
		frame_selected_button.disabled = selected_body == null
```

- [ ] **Step 6: Delete the now-superseded `_pick_piece`/`_ground_hit` duplication check**

No change needed to `_pick_piece` or `_ground_hit` — both are reused as-is by `_on_touch_begin`/`_on_piece_drag` above. Confirm they still exist unmodified below the new functions.

- [ ] **Step 7: Run the existing checks**

Run: `"$GODOT" --headless --path spikes/touch-spike-godot --script snap_check.gd && "$GODOT" --headless --path spikes/touch-spike-godot --script component_check.gd && "$GODOT" --headless --path spikes/touch-spike-godot --script camera_orbit_check.gd`
Expected: all three print `all passed` and exit 0.

- [ ] **Step 8: Manual verification (desktop, mouse via touch emulation)**

Run: `"$GODOT" --path spikes/touch-spike-godot`.
Verify:
- Left-drag on empty space orbits the camera; the two boards do not move.
- Left-drag starting on a board moves that board (snapped to the grid) and the camera does not orbit.
- Each of the 7 view buttons snaps the camera to a distinct, correctly-oriented view (front/back and left/right should look like mirror-image profiles; top/bottom should look straight down/up without flipping upside down).
- Clicking a board then "FRAME SEL" frames just that board; "FRAME ALL" frames both; "FRAME SEL" is disabled with nothing selected.
- Deselecting (click empty space) still works.
- Note: two-finger pan/pinch-zoom cannot be exercised this way (see Global Constraints) — covered in Step 9.

- [ ] **Step 9: Manual verification (physical Android device or emulator)**

Per the existing `spikes/touch-spike-godot/README.md` device-testing instructions, run on a real device or the Android emulator and verify:
- One-finger drag on empty space orbits; one-finger drag on a board moves it.
- Two-finger drag pans; pinch zooms.
- View buttons and Frame All/Selected respond to taps.

- [ ] **Step 10: Commit**

```bash
git add spikes/touch-spike-godot/main.gd
git commit -m "feat(godot-spike): wire multi-touch orbit/pan/zoom and view-control bar"
```

---

## Self-review notes

- **Spec coverage:** data model (Task 1), camera/view system incl. the hit-target gating (Tasks 3-4), view-control bar (Task 4), regression/migration (Task 2), testing — headless (Tasks 1/3) + manual (Task 4) — all covered. Inventory/inspector/hardware/assembly/exploded-view/structural-check are explicitly out of scope per the spec and have no tasks here.
- **Known asymmetry (documented, not silently dropped):** Three.js reuses `@react-three/drei`'s `OrbitControls`; Godot hand-rolls the equivalent because no orbit-camera addon is installed. This is itself a data point for the eventual engine comparison (sub-project 8 in the parent spec's roadmap terms), not an inconsistency to fix.
- **Known limitation:** two-finger gestures cannot be verified on desktop because `pointing/emulate_touch_from_mouse` only ever synthesizes a single touch — Task 4 Step 9 requires a physical device/emulator pass before this task can be called done.
