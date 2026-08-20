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
