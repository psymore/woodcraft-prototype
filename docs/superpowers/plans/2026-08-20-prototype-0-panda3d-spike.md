# Prototype 0 (Panda3D Spike) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a days-scale Panda3D desktop spike with 3-4 hardcoded wood
boards, mouse orbit/pan/zoom camera, click-to-select, single-plane drag,
and grid-only snapping — cheap enough to answer "is board-based assembly
fun" before any mobile or engine commitment is made.

**Architecture:** A small, flat `woodcraft/` package. Pure math (mesh
generation, grid snapping, ray/plane intersection, orbit-camera trig)
lives in standalone modules with no live Panda3D window dependency, so it
is unit-testable with plain pytest. A single `WoodcraftApp(ShowBase)`
class in `app.py` wires that math to live mouse input, scene graph, and
rendering. This code is explicitly throwaway (see spec's *Technology
strategy*) — only the math and data-model shapes are meant to survive
into the real engine, so we do not over-engineer module boundaries beyond
what keeps the math testable.

**Tech Stack:** Python 3.12, Panda3D 1.10.16, pytest.

**Spec:** [docs/superpowers/specs/2026-08-20-woodcraft-prototype-design.md](../specs/2026-08-20-woodcraft-prototype-design.md)

## Global Constraints

- Scope is Prototype 0 only, per spec: "3–4 hardcoded boards, mouse
  orbit/pan/zoom, click-select, single-plane drag, grid-only snap. No
  mobile, no piece-to-piece snapping, no UI chrome, no save."
- Lumber semantics for dimensions: `thickness`, `width`, `length` (not
  generic w/h/d), per spec's *Wood piece data model*.
- No piece-to-piece anchor snapping in P0 — grid snap only (anchor
  snapping is explicitly a later-stage feature per spec's *Woodworking
  intelligence* ranking).
- No CSG, no physics, no parametric joinery — out of scope for the whole
  near-term roadmap per spec's *Modeling philosophy*.
- Units are inches throughout (matches the spec's lumber-dimension
  framing under *Precision & dimensions*, even though P0 has no unit
  display UI yet).

---

## File Structure

```
woodcraft-prototype/
  requirements.txt
  pytest.ini
  woodcraft/
    __init__.py
    geometry.py       # procedural board mesh generation
    piece.py           # Piece dataclass + NodePath builder
    snapping.py        # pure grid-snap math
    raycast.py          # pure ray/plane intersection math
    camera_math.py       # pure orbit/pan/zoom trig
    app.py                 # WoodcraftApp(ShowBase): scene, input, wiring
    main.py                 # CLI entry point
  tests/
    __init__.py
    test_geometry.py
    test_piece.py
    test_snapping.py
    test_raycast.py
    test_camera_math.py
```

Each math module (`snapping.py`, `raycast.py`, `camera_math.py`) uses
plain floats and tuples — no `panda3d` import — so tests run fast and
have zero coupling to scene-graph state. `geometry.py` and `piece.py` do
import `panda3d.core`, but their objects (`GeomNode`, `NodePath`) are
plain data structures that work without an open window, so they are
still directly unit-testable (verified: `GeomVertexData`, `NodePath`,
`Material`, and `LineSegs` all construct and can be inspected with no
`ShowBase` running).

---

### Task 1: Project scaffolding

**Files:**
- Create: `requirements.txt`
- Create: `pytest.ini`
- Create: `woodcraft/__init__.py`
- Create: `tests/__init__.py`
- Test: `tests/test_smoke.py`

**Interfaces:**
- Produces: a working `pytest` invocation and an installable
  `requirements.txt` that later tasks assume is already installed.

- [ ] **Step 1: Create `requirements.txt`**

```
panda3d==1.10.16
pytest==9.1.1
```

- [ ] **Step 2: Create `pytest.ini`**

```ini
[pytest]
testpaths = tests
```

- [ ] **Step 3: Create empty package markers**

Create `woodcraft/__init__.py` (empty file) and `tests/__init__.py`
(empty file).

- [ ] **Step 4: Write a trivial smoke test**

```python
# tests/test_smoke.py
def test_panda3d_core_imports():
    import panda3d.core  # noqa: F401
```

- [ ] **Step 5: Set up the virtualenv and install**

Run (from the repo root, PowerShell):

```
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

- [ ] **Step 6: Run the test suite and verify it passes**

Run: `.venv\Scripts\python.exe -m pytest -v`
Expected: 1 passed (`test_panda3d_core_imports`)

- [ ] **Step 7: Commit**

```bash
git add requirements.txt pytest.ini woodcraft/__init__.py tests/__init__.py tests/test_smoke.py
git commit -m "chore: scaffold Prototype 0 Python package and pytest setup"
```

---

### Task 2: Board mesh geometry

**Files:**
- Create: `woodcraft/geometry.py`
- Test: `tests/test_geometry.py`

**Interfaces:**
- Produces: `make_board_geom_node(thickness: float, width: float, length: float, name: str = "board") -> GeomNode`.
  Local axes: X = length (long axis), Y = width, Z = thickness. Origin is
  the box's geometric center. Consumed by Task 3 (`piece.py`).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_geometry.py
import pytest
from panda3d.core import GeomVertexReader

from woodcraft.geometry import make_board_geom_node


def test_board_mesh_has_24_vertices_and_12_triangles():
    node = make_board_geom_node(thickness=1.5, width=3.5, length=48.0)
    geom = node.get_geom(0)
    vdata = geom.get_vertex_data()
    assert vdata.get_num_rows() == 24
    assert geom.get_primitive(0).get_num_primitives() == 12


def test_board_mesh_bounding_box_matches_dimensions():
    thickness, width, length = 1.5, 3.5, 48.0
    node = make_board_geom_node(thickness, width, length)
    geom = node.get_geom(0)
    vdata = geom.get_vertex_data()
    reader = GeomVertexReader(vdata, "vertex")

    xs, ys, zs = [], [], []
    while not reader.is_at_end():
        x, y, z = reader.get_data3()
        xs.append(x)
        ys.append(y)
        zs.append(z)

    assert max(xs) - min(xs) == pytest.approx(length)
    assert max(ys) - min(ys) == pytest.approx(width)
    assert max(zs) - min(zs) == pytest.approx(thickness)


def test_board_mesh_is_centered_on_origin():
    node = make_board_geom_node(thickness=0.75, width=5.5, length=24.0)
    geom = node.get_geom(0)
    reader = GeomVertexReader(geom.get_vertex_data(), "vertex")

    xs, ys, zs = [], [], []
    while not reader.is_at_end():
        x, y, z = reader.get_data3()
        xs.append(x)
        ys.append(y)
        zs.append(z)

    assert (max(xs) + min(xs)) / 2 == pytest.approx(0.0)
    assert (max(ys) + min(ys)) / 2 == pytest.approx(0.0)
    assert (max(zs) + min(zs)) / 2 == pytest.approx(0.0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_geometry.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'woodcraft.geometry'`

- [ ] **Step 3: Implement `woodcraft/geometry.py`**

```python
# woodcraft/geometry.py
from panda3d.core import (
    Geom,
    GeomNode,
    GeomTriangles,
    GeomVertexData,
    GeomVertexFormat,
    GeomVertexWriter,
    Vec3,
)


def make_board_geom_node(
    thickness: float, width: float, length: float, name: str = "board"
) -> GeomNode:
    """Build a rectangular-prism mesh in lumber semantics.

    Local axes: X = length (long axis), Y = width, Z = thickness.
    Origin is the box's geometric center.
    """
    hx, hy, hz = length / 2.0, width / 2.0, thickness / 2.0

    vertex_format = GeomVertexFormat.get_v3n3()
    vdata = GeomVertexData(name, vertex_format, Geom.UH_static)
    vdata.set_num_rows(24)

    vertex = GeomVertexWriter(vdata, "vertex")
    normal = GeomVertexWriter(vdata, "normal")

    # Each face: outward normal + 4 corners, wound CCW as seen from outside.
    faces = [
        (Vec3(0, 0, 1), [(-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]),
        (Vec3(0, 0, -1), [(-hx, hy, -hz), (hx, hy, -hz), (hx, -hy, -hz), (-hx, -hy, -hz)]),
        (Vec3(0, 1, 0), [(hx, hy, -hz), (-hx, hy, -hz), (-hx, hy, hz), (hx, hy, hz)]),
        (Vec3(0, -1, 0), [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, -hy, hz), (-hx, -hy, hz)]),
        (Vec3(1, 0, 0), [(hx, -hy, -hz), (hx, hy, -hz), (hx, hy, hz), (hx, -hy, hz)]),
        (Vec3(-1, 0, 0), [(-hx, hy, -hz), (-hx, -hy, -hz), (-hx, -hy, hz), (-hx, hy, hz)]),
    ]

    tris = GeomTriangles(Geom.UH_static)
    for face_index, (face_normal, corners) in enumerate(faces):
        base_row = face_index * 4
        for corner in corners:
            vertex.add_data3(*corner)
            normal.add_data3(face_normal)
        tris.add_vertices(base_row, base_row + 1, base_row + 2)
        tris.add_vertices(base_row, base_row + 2, base_row + 3)

    geom = Geom(vdata)
    geom.add_primitive(tris)
    node = GeomNode(name)
    node.add_geom(geom)
    return node
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_geometry.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add woodcraft/geometry.py tests/test_geometry.py
git commit -m "feat: procedural board mesh generation"
```

---

### Task 3: Piece data model + NodePath builder

**Files:**
- Create: `woodcraft/piece.py`
- Test: `tests/test_piece.py`

**Interfaces:**
- Consumes: `make_board_geom_node(thickness, width, length, name) -> GeomNode` (Task 2).
- Produces: `Piece` dataclass with fields `id: str`, `thickness: float`,
  `width: float`, `length: float`, `position: tuple[float, float, float]`,
  `color: tuple[float, float, float, float]`, `hpr: tuple[float, float,
  float] = (0.0, 0.0, 0.0)`.
  Produces: `build_piece_nodepath(piece: Piece, parent: NodePath) ->
  NodePath` — attaches under `parent`, sets pos/hpr/material, tags the
  node `"piece"` so it can be found via `find_net_tag("piece")` during
  picking (Task 9). Consumed by Task 7 (`app.py` scene setup) and Task 9
  (click-select).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_piece.py
import pytest
from panda3d.core import NodePath, PandaNode

from woodcraft.piece import Piece, build_piece_nodepath


def test_build_piece_nodepath_sets_position():
    root = NodePath(PandaNode("root"))
    piece = Piece(
        id="p1", thickness=1.5, width=3.5, length=48.0,
        position=(1.0, 2.0, 0.75), color=(0.6, 0.4, 0.2, 1.0),
    )
    node_path = build_piece_nodepath(piece, root)
    pos = node_path.get_pos()
    assert pos.get_x() == pytest.approx(1.0)
    assert pos.get_y() == pytest.approx(2.0)
    assert pos.get_z() == pytest.approx(0.75)


def test_build_piece_nodepath_is_child_of_parent():
    root = NodePath(PandaNode("root"))
    piece = Piece(
        id="p2", thickness=0.75, width=5.5, length=24.0,
        position=(0.0, 0.0, 0.0), color=(0.5, 0.5, 0.5, 1.0),
    )
    build_piece_nodepath(piece, root)
    assert root.get_num_children() == 1


def test_build_piece_nodepath_is_findable_by_piece_tag():
    root = NodePath(PandaNode("root"))
    piece = Piece(
        id="p3", thickness=1.5, width=3.5, length=36.0,
        position=(0.0, 0.0, 0.0), color=(0.5, 0.3, 0.1, 1.0),
    )
    node_path = build_piece_nodepath(piece, root)
    child_of_node = node_path.attach_new_node("grandchild")

    found = child_of_node.find_net_tag("piece")

    assert not found.is_empty()
    assert found == node_path
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_piece.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'woodcraft.piece'`

- [ ] **Step 3: Implement `woodcraft/piece.py`**

```python
# woodcraft/piece.py
from dataclasses import dataclass
from typing import Tuple

from panda3d.core import Material, NodePath

from woodcraft.geometry import make_board_geom_node

Color = Tuple[float, float, float, float]
Vec3f = Tuple[float, float, float]


@dataclass
class Piece:
    id: str
    thickness: float
    width: float
    length: float
    position: Vec3f
    color: Color
    hpr: Vec3f = (0.0, 0.0, 0.0)


def build_piece_nodepath(piece: Piece, parent: NodePath) -> NodePath:
    geom_node = make_board_geom_node(piece.thickness, piece.width, piece.length, name=piece.id)
    node_path = parent.attach_new_node(geom_node)
    node_path.set_pos(*piece.position)
    node_path.set_hpr(*piece.hpr)
    node_path.set_two_sided(True)
    node_path.set_tag("piece", "1")

    material = Material()
    material.set_diffuse(piece.color)
    material.set_ambient(piece.color)
    node_path.set_material(material)

    return node_path
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_piece.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add woodcraft/piece.py tests/test_piece.py
git commit -m "feat: Piece data model and NodePath builder"
```

---

### Task 4: Grid snapping math

**Files:**
- Create: `woodcraft/snapping.py`
- Test: `tests/test_snapping.py`

**Interfaces:**
- Produces: `snap_value(value: float, increment: float) -> float`,
  `snap_xy(x: float, y: float, increment: float) -> tuple[float, float]`.
  Consumed by Task 10 (plane-constrained drag).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_snapping.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_snapping.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'woodcraft.snapping'`

- [ ] **Step 3: Implement `woodcraft/snapping.py`**

```python
# woodcraft/snapping.py
from typing import Tuple


def snap_value(value: float, increment: float) -> float:
    if increment <= 0:
        return value
    return round(value / increment) * increment


def snap_xy(x: float, y: float, increment: float) -> Tuple[float, float]:
    return snap_value(x, increment), snap_value(y, increment)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_snapping.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add woodcraft/snapping.py tests/test_snapping.py
git commit -m "feat: grid snapping math"
```

---

### Task 5: Ray/plane intersection math

**Files:**
- Create: `woodcraft/raycast.py`
- Test: `tests/test_raycast.py`

**Interfaces:**
- Produces: `intersect_ray_plane(ray_origin: tuple[float, float, float],
  ray_dir: tuple[float, float, float], plane_point: tuple[float, float,
  float], plane_normal: tuple[float, float, float]) -> tuple[float,
  float, float] | None`. Returns `None` for a ray parallel to the plane
  or pointing away from it. Consumed by Task 10 (plane-constrained drag).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_raycast.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_raycast.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'woodcraft.raycast'`

- [ ] **Step 3: Implement `woodcraft/raycast.py`**

```python
# woodcraft/raycast.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_raycast.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add woodcraft/raycast.py tests/test_raycast.py
git commit -m "feat: ray/plane intersection math"
```

---

### Task 6: Orbit camera math

**Files:**
- Create: `woodcraft/camera_math.py`
- Test: `tests/test_camera_math.py`

**Interfaces:**
- Produces:
  - `orbit_position(target: tuple[float,float,float], heading_deg: float, pitch_deg: float, distance: float) -> tuple[float,float,float]`
  - `update_orbit_angles(heading_deg: float, pitch_deg: float, dx: float, dy: float, sensitivity: float = 200.0, min_pitch: float = -80.0, max_pitch: float = 80.0) -> tuple[float, float]`
  - `zoom_distance(distance: float, wheel_delta: float, factor: float = 0.9, min_distance: float = 10.0, max_distance: float = 500.0) -> float`
  - `pan_target(target: tuple[float,float,float], right: tuple[float,float,float], up: tuple[float,float,float], dx: float, dy: float, sensitivity: float = 100.0) -> tuple[float,float,float]`
  Consumed by Task 7 (initial camera placement) and Task 8 (live camera input).

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_camera_math.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv\Scripts\python.exe -m pytest tests/test_camera_math.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'woodcraft.camera_math'`

- [ ] **Step 3: Implement `woodcraft/camera_math.py`**

```python
# woodcraft/camera_math.py
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv\Scripts\python.exe -m pytest tests/test_camera_math.py -v`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add woodcraft/camera_math.py tests/test_camera_math.py
git commit -m "feat: orbit/pan/zoom camera math"
```

---

### Task 7: App scaffold — scene, hardcoded boards, ground grid, smoke test

**Files:**
- Create: `woodcraft/app.py`
- Create: `woodcraft/main.py`
- Test: `tests/test_app_smoke.py`

**Interfaces:**
- Consumes: `Piece`, `build_piece_nodepath` (Task 3); `orbit_position`
  (Task 6).
- Produces: `WoodcraftApp(ShowBase)` with attributes `self.pieces: list[Piece]`,
  `self.piece_nodes: list[NodePath]`, `self.cam_target: tuple[float,float,float]`,
  `self.cam_heading: float`, `self.cam_pitch: float`, `self.cam_distance: float`,
  and method `self.update_camera_pos() -> None`. Consumed by Task 8, 9, 10
  (which extend this class in place) and by `main.py`.
  Produces: `main.py` with a `--smoke-test` CLI flag that renders a few
  frames, saves a screenshot, and exits without entering the blocking
  event loop — this is what makes the app automatable in Task 7's test
  and in CI-less local verification.

- [ ] **Step 1: Write the failing smoke test**

```python
# tests/test_app_smoke.py
import subprocess
import sys
from pathlib import Path


def test_app_boots_and_renders_in_smoke_test_mode(tmp_path):
    screenshot_path = tmp_path / "smoke.png"
    result = subprocess.run(
        [sys.executable, "-m", "woodcraft.main", "--smoke-test", "--screenshot", str(screenshot_path)],
        cwd=Path(__file__).resolve().parent.parent,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert screenshot_path.exists()
    assert screenshot_path.stat().st_size > 0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv\Scripts\python.exe -m pytest tests/test_app_smoke.py -v`
Expected: FAIL (`woodcraft.main` doesn't exist / non-zero exit)

- [ ] **Step 3: Implement `woodcraft/app.py`**

```python
# woodcraft/app.py
from direct.showbase.ShowBase import ShowBase
from panda3d.core import AmbientLight, DirectionalLight, LineSegs

from woodcraft.camera_math import orbit_position
from woodcraft.piece import Piece, build_piece_nodepath

GRID_INCREMENT = 1.0  # inches
GRID_EXTENT = 60.0  # inches, half-width of the drawn ground grid

DEFAULT_PIECES = [
    Piece(
        id="stud-48", thickness=1.5, width=3.5, length=48.0,
        position=(-24.0, -12.0, 0.75), color=(0.65, 0.45, 0.25, 1.0),
    ),
    Piece(
        id="stud-36", thickness=1.5, width=3.5, length=36.0,
        position=(24.0, -12.0, 0.75), color=(0.55, 0.37, 0.20, 1.0),
    ),
    Piece(
        id="board-48", thickness=0.75, width=5.5, length=48.0,
        position=(-24.0, 12.0, 0.375), color=(0.72, 0.55, 0.32, 1.0),
    ),
    Piece(
        id="board-24", thickness=0.75, width=5.5, length=24.0,
        position=(24.0, 12.0, 0.375), color=(0.60, 0.42, 0.24, 1.0),
    ),
]


def make_ground_grid(extent: float, increment: float):
    line_segs = LineSegs()
    line_segs.set_color(0.5, 0.5, 0.5, 1.0)
    steps = int(extent / increment)
    for i in range(-steps, steps + 1):
        coord = i * increment
        line_segs.move_to(coord, -extent, 0)
        line_segs.draw_to(coord, extent, 0)
        line_segs.move_to(-extent, coord, 0)
        line_segs.draw_to(extent, coord, 0)
    return line_segs.create()


class WoodcraftApp(ShowBase):
    def __init__(self, pieces=None):
        super().__init__()
        self.disable_mouse()

        self.pieces = pieces if pieces is not None else list(DEFAULT_PIECES)
        self.piece_nodes = [build_piece_nodepath(piece, self.render) for piece in self.pieces]

        self.render.attach_new_node(make_ground_grid(GRID_EXTENT, GRID_INCREMENT))

        self._setup_lighting()

        self.cam_target = (0.0, 0.0, 0.0)
        self.cam_heading = 25.0
        self.cam_pitch = 25.0
        self.cam_distance = 120.0
        self.update_camera_pos()

    def _setup_lighting(self):
        ambient = AmbientLight("ambient")
        ambient.set_color((0.35, 0.35, 0.35, 1.0))
        self.render.set_light(self.render.attach_new_node(ambient))

        sun = DirectionalLight("sun")
        sun.set_color((0.9, 0.85, 0.8, 1.0))
        sun_np = self.render.attach_new_node(sun)
        sun_np.set_hpr(45, -60, 0)
        self.render.set_light(sun_np)

        self.render.set_shader_auto()

    def update_camera_pos(self):
        pos = orbit_position(self.cam_target, self.cam_heading, self.cam_pitch, self.cam_distance)
        self.camera.set_pos(*pos)
        self.camera.look_at(*self.cam_target)
```

- [ ] **Step 4: Implement `woodcraft/main.py`**

```python
# woodcraft/main.py
import argparse
import sys

from woodcraft.app import WoodcraftApp


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke-test", action="store_true")
    parser.add_argument("--screenshot", default="smoke.png")
    args = parser.parse_args(argv)

    app = WoodcraftApp()

    if args.smoke_test:
        app.graphics_engine.render_frame()
        app.graphics_engine.render_frame()
        app.win.save_screenshot(args.screenshot)
        app.destroy()
        return 0

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv\Scripts\python.exe -m pytest tests/test_app_smoke.py -v`
Expected: 1 passed

- [ ] **Step 6: Manual check — confirm the window actually shows boards**

Run: `.venv\Scripts\python.exe -m woodcraft.main`
Expected: a window opens showing 4 tan/brown boards resting on a gray
grid, viewed from a slightly elevated angle. Close the window (or Esc)
to exit. This confirms the scene renders correctly before wiring input
in the next tasks.

- [ ] **Step 7: Commit**

```bash
git add woodcraft/app.py woodcraft/main.py tests/test_app_smoke.py
git commit -m "feat: app scaffold with hardcoded boards, lighting, ground grid, and smoke-test mode"
```

---

### Task 8: Camera input — orbit, pan, zoom

**Files:**
- Modify: `woodcraft/app.py`

**Interfaces:**
- Consumes: `update_orbit_angles`, `zoom_distance`, `pan_target` (Task 6);
  `self.update_camera_pos()` (Task 7).
- Produces: live mouse-driven camera control. No new pure functions —
  this task is input wiring, verified manually (mouse-driven camera
  motion cannot be meaningfully asserted by an automated test without a
  synthetic-input harness, which is out of scope for a days-scale spike).

Input mapping (mirrors the spec's mobile "hit-target determines mode"
rule, adapted to desktop mouse buttons):
- Left button drag over empty space → orbit.
- Right button drag → pan.
- Scroll wheel → zoom.
- Left button drag over a piece is reserved for Task 9/10 (select + drag) — this task must not intercept clicks on pieces, so orbit only starts when nothing is picked (Task 9 wires the actual pick check; for now, this task treats every left-drag as orbit, and Task 9 will add the pick check that suppresses orbit when a piece is hit).

- [ ] **Step 1: Add mouse-state fields and event bindings to `__init__`**

Add after `self.update_camera_pos()` in `WoodcraftApp.__init__`:

```python
        self._last_mouse = None
        self._orbiting = False
        self._panning = False
        self._dragging_piece = None  # populated by Task 9/10
        self._selected = None  # populated by Task 9

        self.accept("mouse1", self._on_mouse1_down)
        self.accept("mouse1-up", self._on_mouse1_up)
        self.accept("mouse3", self._on_mouse3_down)
        self.accept("mouse3-up", self._on_mouse3_up)
        self.accept("wheel_up", self._on_wheel_up)
        self.accept("wheel_down", self._on_wheel_down)

        self.task_mgr.add(self._on_frame, "woodcraft-update")
```

- [ ] **Step 2: Add the event handlers and frame task**

Add these methods to `WoodcraftApp`:

```python
    def _on_mouse1_down(self):
        self._orbiting = True

    def _on_mouse1_up(self):
        self._orbiting = False
        self._dragging_piece = None

    def _on_mouse3_down(self):
        self._panning = True

    def _on_mouse3_up(self):
        self._panning = False

    def _on_wheel_up(self):
        self.cam_distance = zoom_distance(self.cam_distance, wheel_delta=1)
        self.update_camera_pos()

    def _on_wheel_down(self):
        self.cam_distance = zoom_distance(self.cam_distance, wheel_delta=-1)
        self.update_camera_pos()

    def _camera_right_up(self):
        quat = self.camera.get_quat(self.render)
        return tuple(quat.get_right()), tuple(quat.get_up())

    def _on_frame(self, task):
        if not self.mouseWatcherNode.has_mouse():
            self._last_mouse = None
            return Task.cont

        mouse = self.mouseWatcherNode.get_mouse()
        current = (mouse.get_x(), mouse.get_y())

        if self._last_mouse is None:
            self._last_mouse = current
            return Task.cont

        dx = current[0] - self._last_mouse[0]
        dy = current[1] - self._last_mouse[1]

        if self._dragging_piece is not None:
            self._update_drag(mouse)
        elif self._orbiting:
            self.cam_heading, self.cam_pitch = update_orbit_angles(
                self.cam_heading, self.cam_pitch, dx, dy
            )
            self.update_camera_pos()
        elif self._panning:
            right, up = self._camera_right_up()
            self.cam_target = pan_target(self.cam_target, right, up, dx, dy)
            self.update_camera_pos()

        self._last_mouse = current
        return Task.cont

    def _update_drag(self, mouse):
        pass  # implemented in Task 10
```

Note the `task` parameter passed into a Panda3D task callback does **not**
carry a `.cont` attribute — the continuation constant lives on the
`direct.task.Task` module instead. Using `task.cont` here would raise
`AttributeError` on the very first frame.

- [ ] **Step 3: Add the new imports**

At the top of `woodcraft/app.py`, update the import from `woodcraft.camera_math` and add the `Task` import:

```python
from direct.task import Task
from woodcraft.camera_math import orbit_position, pan_target, update_orbit_angles, zoom_distance
```

- [ ] **Step 4: Run the existing smoke test to verify nothing broke**

Run: `.venv\Scripts\python.exe -m pytest tests/test_app_smoke.py -v`
Expected: 1 passed

- [ ] **Step 5: Manual check — camera controls**

Run: `.venv\Scripts\python.exe -m woodcraft.main`

Verify:
- Left-drag on empty space orbits the camera around the boards.
- Right-drag pans the view.
- Scroll wheel zooms in/out, and stops changing past very close/far
  distances (the clamp in `zoom_distance`).

- [ ] **Step 6: Commit**

```bash
git add woodcraft/app.py
git commit -m "feat: wire orbit/pan/zoom mouse input to camera"
```

---

### Task 9: Click-select with highlight

**Files:**
- Modify: `woodcraft/app.py`

**Interfaces:**
- Consumes: the `"piece"` tag set by `build_piece_nodepath` (Task 3).
- Produces: `self._selected: NodePath | None`, updated on click. Consumed
  by Task 10 (drag needs to know which piece is selected).

This task is manually verified for the same reason as Task 8: it depends
on live mouse click position over a rendered scene.

- [ ] **Step 1: Add collision-picking setup to `__init__`**

Extend the existing `panda3d.core` import at the top of `woodcraft/app.py`
(from Task 7) to also pull in the collision classes:

```python
from panda3d.core import (
    AmbientLight,
    CollisionHandlerQueue,
    CollisionNode,
    CollisionRay,
    CollisionTraverser,
    DirectionalLight,
    GeomNode,
    LineSegs,
)
```

Then add this to `__init__`, after the mouse/task setup from Task 8:

```python
        self._picker_traverser = CollisionTraverser()
        self._picker_queue = CollisionHandlerQueue()
        picker_node = CollisionNode("mouseRay")
        picker_node.set_from_collide_mask(GeomNode.get_default_collide_mask())
        self._picker_ray = CollisionRay()
        picker_node.add_solid(self._picker_ray)
        picker_np = self.camera.attach_new_node(picker_node)
        self._picker_traverser.add_collider(picker_np, self._picker_queue)
```

- [ ] **Step 2: Replace `_on_mouse1_down` to pick before orbiting**

Replace the Task 8 version of `_on_mouse1_down` with:

```python
    def _on_mouse1_down(self):
        picked = self._pick_piece()
        if picked is not None:
            self._select(picked)
            self._dragging_piece = picked
        else:
            self._select(None)
            self._orbiting = True

    def _pick_piece(self):
        if not self.mouseWatcherNode.has_mouse():
            return None
        mouse = self.mouseWatcherNode.get_mouse()
        self._picker_ray.set_from_lens(self.camNode, mouse.get_x(), mouse.get_y())
        self._picker_traverser.traverse(self.render)
        if self._picker_queue.get_num_entries() == 0:
            return None
        self._picker_queue.sort_entries()
        entry = self._picker_queue.get_entry(0)
        found = entry.get_into_node_path().find_net_tag("piece")
        return None if found.is_empty() else found

    def _select(self, node_path):
        if self._selected is not None:
            self._selected.clear_color_scale()
        self._selected = node_path
        if self._selected is not None:
            self._selected.set_color_scale(1.4, 1.4, 1.4, 1.0)
```

- [ ] **Step 3: Run the existing smoke test to verify nothing broke**

Run: `.venv\Scripts\python.exe -m pytest tests/test_app_smoke.py -v`
Expected: 1 passed

- [ ] **Step 4: Manual check — select/deselect**

Run: `.venv\Scripts\python.exe -m woodcraft.main`

Verify:
- Clicking a board brightens it (selection highlight) and does not
  orbit the camera.
- Clicking a second board moves the highlight to it and clears the
  first one's highlight.
- Clicking empty space clears the highlight and orbiting resumes.

- [ ] **Step 5: Commit**

```bash
git add woodcraft/app.py
git commit -m "feat: click-to-select pieces with highlight"
```

---

### Task 10: Plane-constrained drag with grid snap

**Files:**
- Modify: `woodcraft/app.py`

**Interfaces:**
- Consumes: `intersect_ray_plane` (Task 5), `snap_xy` (Task 4),
  `self._dragging_piece` (Task 9).
- Produces: live drag-to-move behavior on the selected piece, snapped to
  `GRID_INCREMENT`. Manually verified for the same reason as Tasks 8-9.

- [ ] **Step 1: Add the new imports**

At the top of `woodcraft/app.py`:

```python
from woodcraft.raycast import intersect_ray_plane
from woodcraft.snapping import snap_xy
```

- [ ] **Step 2: Track the drag plane height when a drag starts**

Update `_on_mouse1_down` (from Task 9) so that when a piece is picked, it
also records the world-space Z the piece will be dragged across:

```python
    def _on_mouse1_down(self):
        picked = self._pick_piece()
        if picked is not None:
            self._select(picked)
            self._dragging_piece = picked
            self._drag_plane_z = picked.get_z(self.render)
        else:
            self._select(None)
            self._orbiting = True
```

- [ ] **Step 3: Implement `_update_drag`**

Replace the `pass` placeholder from Task 8 with:

```python
    def _update_drag(self, mouse):
        near = Point3()
        far = Point3()
        if not self.camLens.extrude(mouse, near, far):
            return

        world_near = self.render.get_relative_point(self.camera, near)
        world_far = self.render.get_relative_point(self.camera, far)
        ray_dir = world_far - world_near

        hit = intersect_ray_plane(
            ray_origin=(world_near.get_x(), world_near.get_y(), world_near.get_z()),
            ray_dir=(ray_dir.get_x(), ray_dir.get_y(), ray_dir.get_z()),
            plane_point=(0.0, 0.0, self._drag_plane_z),
            plane_normal=(0.0, 0.0, 1.0),
        )
        if hit is None:
            return

        snapped_x, snapped_y = snap_xy(hit[0], hit[1], GRID_INCREMENT)
        self._dragging_piece.set_pos(self.render, snapped_x, snapped_y, self._drag_plane_z)
```

Add `Point3` to the `panda3d.core` import block at the top of
`woodcraft/app.py` (the one extended in Task 9), so it reads:

```python
from panda3d.core import (
    AmbientLight,
    CollisionHandlerQueue,
    CollisionNode,
    CollisionRay,
    CollisionTraverser,
    DirectionalLight,
    GeomNode,
    LineSegs,
    Point3,
)
```

- [ ] **Step 4: Run the existing smoke test to verify nothing broke**

Run: `.venv\Scripts\python.exe -m pytest tests/test_app_smoke.py -v`
Expected: 1 passed

- [ ] **Step 5: Manual check — drag and snap**

Run: `.venv\Scripts\python.exe -m woodcraft.main`

Verify:
- Clicking and holding on a board, then moving the mouse, drags the
  board across the ground plane while the button is held.
- The board's position visibly jumps in 1-inch increments (grid snap)
  rather than moving continuously.
- The board stays at its original height while being dragged.
- Releasing the button stops the drag; orbiting on empty space and
  clicking other boards still works afterward.

- [ ] **Step 6: Commit**

```bash
git add woodcraft/app.py
git commit -m "feat: plane-constrained drag with grid snap"
```

---

### Task 11: README update and final playtest pass

**Files:**
- Modify: `README.md`

**Interfaces:**
- None (documentation only).

- [ ] **Step 1: Add run instructions to `README.md`**

Insert after the existing final paragraph in `README.md`:

```markdown

## Running Prototype 0

```
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m woodcraft.main
```

Controls: left-drag empty space to orbit, left-drag a board to select
and move it (snapped to a 1" grid), right-drag to pan, scroll wheel to
zoom.

Run tests: `.venv\Scripts\python.exe -m pytest`
```

- [ ] **Step 2: Full manual playtest**

Run: `.venv\Scripts\python.exe -m woodcraft.main`

Walk through the full interaction loop end to end:
1. Orbit around all four boards using left-drag on empty space.
2. Pan and zoom to frame them differently.
3. Select each board in turn, confirming only one is highlighted at a
   time.
4. Drag two boards so their edges land adjacent to each other using the
   grid snap, approximating an assembled joint.
5. Note subjectively: does nudging boards into place along the grid
   feel like it's heading toward "fun, board-based assembly," per the
   spec's stated purpose for this prototype? This judgment is the actual
   deliverable of Prototype 0 — record it (even informally) since it
   determines whether the "Platform decision + comparative touch spike"
   stage is worth scheduling next.

- [ ] **Step 3: Run the full automated test suite one last time**

Run: `.venv\Scripts\python.exe -m pytest -v`
Expected: all tests passed (smoke + geometry + piece + snapping +
raycast + camera_math + app smoke)

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add Prototype 0 run instructions"
```

---

## Self-Review Notes

- **Spec coverage:** hardcoded boards (Task 7), mouse orbit/pan/zoom
  (Task 8), click-select (Task 9), single-plane drag (Task 10),
  grid-only snap (Task 10 via `snap_xy`), lumber-semantics data model
  (Task 3's `Piece`), no mobile/no piece-to-piece snap/no UI chrome/no
  save (none implemented, matching P0 scope) — all covered.
- **Type consistency:** `Piece.position`/`color`/`hpr` tuple shapes match
  between Task 3's definition and Task 7's `DEFAULT_PIECES` usage.
  `orbit_position`/`update_orbit_angles`/`zoom_distance`/`pan_target`
  signatures in Task 6 match their call sites in Tasks 7-8.
  `intersect_ray_plane`/`snap_xy` signatures in Tasks 4-5 match their
  call site in Task 10.
- Tasks 8-10 modify the same file (`app.py`) incrementally rather than
  each owning a separate module, because they share live mouse/task
  state (`_last_mouse`, `_orbiting`, `_dragging_piece`, `_selected`) that
  only makes sense as one object's state machine — splitting them into
  separate files would require passing that whole state machine across
  module boundaries for no testability benefit, since none of it runs
  without a live window anyway.
