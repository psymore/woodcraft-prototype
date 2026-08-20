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
