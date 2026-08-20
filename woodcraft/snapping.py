from typing import Tuple


def snap_value(value: float, increment: float) -> float:
    if increment <= 0:
        return value
    return round(value / increment) * increment


def snap_xy(x: float, y: float, increment: float) -> Tuple[float, float]:
    return snap_value(x, increment), snap_value(y, increment)
