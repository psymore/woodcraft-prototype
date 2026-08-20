# woodcraft/main.py
import argparse
import sys

from panda3d.core import Filename

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
        # NOTE: GraphicsWindow.save_screenshot() silently fails (returns False,
        # writes nothing) when given a plain Python str for an *absolute*
        # Windows path such as "C:/Users/...": Panda's implicit str->Filename
        # conversion does not translate the drive letter, so the write
        # resolves incorrectly. Filename.from_os_specific() performs the
        # correct OS-path translation. Verified against the installed
        # Panda3D 1.10.16 in this environment (Windows / wglGraphicsPipe).
        app.win.save_screenshot(Filename.from_os_specific(args.screenshot))
        app.destroy()
        return 0

    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
