export function snapValue(value: number, increment: number): number {
  if (increment <= 0) return value
  return Math.round(value / increment) * increment
}
