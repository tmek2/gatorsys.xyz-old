/** Keep the whole card inside the pane, including a corner grab. */
export function boundedPosition(
  pointer: number,
  grab: number,
  size: number,
  min: number,
  max: number,
) {
  return Math.max(min, Math.min(pointer - grab, Math.max(min, max - size)));
}
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return items;
  const next = [...items];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
