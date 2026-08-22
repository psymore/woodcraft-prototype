# main.gd
extends Node3D

const Snap = preload("res://snap.gd")
const GRID_INCREMENT := 1.0
const GRID_EXTENT := 60.0  # inches, half-width of the drawn ground grid

var camera: Camera3D
var selected_body: StaticBody3D = null
var dragging := false
var drag_offset := Vector2.ZERO
var drag_plane_y := 0.0


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_on_touch_begin(event.position)
		else:
			dragging = false
	elif event is InputEventScreenDrag:
		if dragging:
			_on_touch_drag(event.position)


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
