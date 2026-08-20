import pytest

from woodcraft.raycast import intersect_ray_plane


def test_intersect_straight_down_hits_ground_plane():
    hit = intersect_ray_plane(
        ray_origin=(0.0, 0.0, 10.0),
        ray_dir=(0.0, 0.0, -1.0),
        plane_point=(0.0, 0.0, 0.0),
        plane_normal=(0.0, 0.0, 1.0),
    )
    assert hit == (pytest.approx(0.0), pytest.approx(0.0), pytest.approx(0.0))


def test_intersect_oblique_ray_hits_correct_point():
    hit = intersect_ray_plane(
        ray_origin=(0.0, 0.0, 10.0),
        ray_dir=(1.0, 0.0, -1.0),
        plane_point=(0.0, 0.0, 0.0),
        plane_normal=(0.0, 0.0, 1.0),
    )
    assert hit == (pytest.approx(10.0), pytest.approx(0.0), pytest.approx(0.0))


def test_intersect_parallel_ray_returns_none():
    hit = intersect_ray_plane(
        ray_origin=(0.0, 0.0, 5.0),
        ray_dir=(1.0, 0.0, 0.0),
        plane_point=(0.0, 0.0, 0.0),
        plane_normal=(0.0, 0.0, 1.0),
    )
    assert hit is None


def test_intersect_ray_pointing_away_returns_none():
    hit = intersect_ray_plane(
        ray_origin=(0.0, 0.0, -5.0),
        ray_dir=(0.0, 0.0, -1.0),
        plane_point=(0.0, 0.0, 0.0),
        plane_normal=(0.0, 0.0, 1.0),
    )
    assert hit is None
