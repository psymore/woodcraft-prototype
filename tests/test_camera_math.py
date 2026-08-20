import pytest

from woodcraft.camera_math import (
    orbit_position,
    pan_target,
    update_orbit_angles,
    zoom_distance,
)


def test_orbit_position_at_zero_heading_and_pitch_sits_behind_target():
    pos = orbit_position(target=(0.0, 0.0, 0.0), heading_deg=0.0, pitch_deg=0.0, distance=10.0)
    assert pos == (pytest.approx(0.0), pytest.approx(-10.0), pytest.approx(0.0))


def test_orbit_position_at_90_heading_moves_to_positive_x():
    pos = orbit_position(target=(0.0, 0.0, 0.0), heading_deg=90.0, pitch_deg=0.0, distance=10.0)
    assert pos == (pytest.approx(10.0), pytest.approx(0.0), pytest.approx(0.0))


def test_orbit_position_at_90_pitch_sits_directly_above_target():
    pos = orbit_position(target=(0.0, 0.0, 0.0), heading_deg=0.0, pitch_deg=90.0, distance=10.0)
    assert pos == (pytest.approx(0.0), pytest.approx(0.0), pytest.approx(10.0))


def test_update_orbit_angles_applies_sensitivity_and_wraps_heading():
    heading, pitch = update_orbit_angles(
        heading_deg=10.0, pitch_deg=0.0, dx=0.1, dy=0.05, sensitivity=200.0
    )
    assert heading == pytest.approx(350.0)
    assert pitch == pytest.approx(10.0)


def test_update_orbit_angles_clamps_pitch():
    _, pitch = update_orbit_angles(
        heading_deg=0.0, pitch_deg=75.0, dx=0.0, dy=1.0, sensitivity=200.0, max_pitch=80.0
    )
    assert pitch == pytest.approx(80.0)


def test_zoom_distance_scales_by_factor_per_wheel_click():
    assert zoom_distance(distance=100.0, wheel_delta=1, factor=0.9) == pytest.approx(90.0)
    assert zoom_distance(distance=100.0, wheel_delta=-1, factor=0.9) == pytest.approx(100.0 / 0.9)


def test_zoom_distance_clamps_to_min():
    result = zoom_distance(
        distance=10.5, wheel_delta=5, factor=0.5, min_distance=10.0, max_distance=500.0
    )
    assert result == pytest.approx(10.0)


def test_pan_target_moves_target_by_screen_axes():
    target = pan_target(
        target=(0.0, 0.0, 0.0), right=(1.0, 0.0, 0.0), up=(0.0, 0.0, 1.0),
        dx=1.0, dy=0.0, sensitivity=1.0,
    )
    assert target == (pytest.approx(-1.0), pytest.approx(0.0), pytest.approx(0.0))

    target = pan_target(
        target=(0.0, 0.0, 0.0), right=(1.0, 0.0, 0.0), up=(0.0, 0.0, 1.0),
        dx=0.0, dy=1.0, sensitivity=2.0,
    )
    assert target == (pytest.approx(0.0), pytest.approx(0.0), pytest.approx(2.0))
