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
