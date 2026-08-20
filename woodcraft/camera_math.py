import math
from typing import Tuple

Vec3f = Tuple[float, float, float]


def orbit_position(target: Vec3f, heading_deg: float, pitch_deg: float, distance: float) -> Vec3f:
    h = math.radians(heading_deg)
    p = math.radians(pitch_deg)
    x = target[0] + distance * math.cos(p) * math.sin(h)
    y = target[1] - distance * math.cos(p) * math.cos(h)
    z = target[2] + distance * math.sin(p)
    return (x, y, z)


def update_orbit_angles(
    heading_deg: float,
    pitch_deg: float,
    dx: float,
    dy: float,
    sensitivity: float = 200.0,
    min_pitch: float = -80.0,
    max_pitch: float = 80.0,
) -> Tuple[float, float]:
    new_heading = (heading_deg - dx * sensitivity) % 360.0
    new_pitch = pitch_deg + dy * sensitivity
    new_pitch = max(min_pitch, min(max_pitch, new_pitch))
    return new_heading, new_pitch


def zoom_distance(
    distance: float,
    wheel_delta: float,
    factor: float = 0.9,
    min_distance: float = 10.0,
    max_distance: float = 500.0,
) -> float:
    new_distance = distance * (factor ** wheel_delta)
    return max(min_distance, min(max_distance, new_distance))


def pan_target(
    target: Vec3f, right: Vec3f, up: Vec3f, dx: float, dy: float, sensitivity: float = 100.0
) -> Vec3f:
    return (
        target[0] - right[0] * dx * sensitivity + up[0] * dy * sensitivity,
        target[1] - right[1] * dx * sensitivity + up[1] * dy * sensitivity,
        target[2] - right[2] * dx * sensitivity + up[2] * dy * sensitivity,
    )
