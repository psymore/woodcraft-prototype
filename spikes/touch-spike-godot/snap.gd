# snap.gd
extends RefCounted

static func snap_value(value: float, increment: float) -> float:
	if increment <= 0.0:
		return value
	return round(value / increment) * increment
