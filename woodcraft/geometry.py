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
