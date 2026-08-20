from typing import Optional, Tuple

Vec3f = Tuple[float, float, float]


def intersect_ray_plane(
    ray_origin: Vec3f, ray_dir: Vec3f, plane_point: Vec3f, plane_normal: Vec3f
) -> Optional[Vec3f]:
    ox, oy, oz = ray_origin
    dx, dy, dz = ray_dir
    px, py, pz = plane_point
    nx, ny, nz = plane_normal

    denom = dx * nx + dy * ny + dz * nz
    if abs(denom) < 1e-9:
        return None

    t = ((px - ox) * nx + (py - oy) * ny + (pz - oz) * nz) / denom
    if t < 0:
        return None

    return (ox + dx * t, oy + dy * t, oz + dz * t)
