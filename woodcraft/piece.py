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
