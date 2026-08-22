# main.gd
extends Node3D

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


func _unhandled_input(event: InputEvent) -> void:
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


func _ready() -> void:
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-60, 45, 0)
	add_child(sun)

	var ground := MeshInstance3D.new()
	ground.mesh = _make_ground_grid(GRID_EXTENT, GRID_INCREMENT)
	var ground_material := StandardMaterial3D.new()
	ground_material.albedo_color = Color(0.5, 0.5, 0.5, 1.0)
	ground_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ground.material_override = ground_material
	add_child(ground)

	var board_definition := Components.board_definition()
	for instance in Components.initial_board_instances():
		_add_piece(instance, board_definition)

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

	print("READY_OK")

	if OS.get_cmdline_user_args().has("--smoke-test"):
		for i in range(3):
			await get_tree().process_frame
		var img := get_viewport().get_texture().get_image()
		img.save_png("res://smoke_test_screenshot.png")
		print("SMOKE_TEST_SCREENSHOT_SAVED")
		get_tree().quit()


func _make_ground_grid(extent: float, increment: float) -> ArrayMesh:
	var vertices := PackedVector3Array()
	var steps := int(extent / increment)
	for i in range(-steps, steps + 1):
		var coord := i * increment
		vertices.append(Vector3(coord, 0, -extent))
		vertices.append(Vector3(coord, 0, extent))
		vertices.append(Vector3(-extent, 0, coord))
		vertices.append(Vector3(extent, 0, coord))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_LINES, arrays)
	return mesh


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
	if frame_selected_button != null:
		frame_selected_button.disabled = selected_body == null


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


func _ground_hit(screen_pos: Vector2, plane_y: float):
	var ray_origin := camera.project_ray_origin(screen_pos)
	var ray_dir := camera.project_ray_normal(screen_pos)
	var plane := Plane(Vector3(0, 1, 0), plane_y)
	return plane.intersects_ray(ray_origin, ray_dir)


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
