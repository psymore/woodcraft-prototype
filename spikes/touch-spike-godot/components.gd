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
