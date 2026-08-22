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
