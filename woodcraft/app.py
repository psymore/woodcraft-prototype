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
