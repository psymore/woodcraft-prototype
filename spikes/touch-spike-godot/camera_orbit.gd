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
