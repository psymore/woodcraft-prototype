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
