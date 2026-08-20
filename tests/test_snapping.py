import pytest

from woodcraft.snapping import snap_value, snap_xy


def test_snap_value_rounds_to_nearest_increment():
    assert snap_value(1.3, 1.0) == pytest.approx(1.0)
    assert snap_value(1.6, 1.0) == pytest.approx(2.0)
    assert snap_value(4.3, 0.5) == pytest.approx(4.5)


def test_snap_value_handles_negative_numbers():
    assert snap_value(-1.3, 1.0) == pytest.approx(-1.0)
    assert snap_value(-1.6, 1.0) == pytest.approx(-2.0)


def test_snap_value_zero_increment_returns_value_unchanged():
    assert snap_value(3.14159, 0.0) == pytest.approx(3.14159)


def test_snap_xy_snaps_both_axes_independently():
    assert snap_xy(1.3, 4.3, 0.5) == (pytest.approx(1.5), pytest.approx(4.5))
