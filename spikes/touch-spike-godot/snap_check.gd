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
