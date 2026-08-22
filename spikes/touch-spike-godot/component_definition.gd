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
