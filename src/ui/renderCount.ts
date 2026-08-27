// Render accounting for the no-rerender acceptance test (§17.3).
//
// A React render during playback is a defect, so the test needs a number rather
// than a profiler screenshot. Cheap enough to leave in.

const counts = new Map<string, number>()

export function countRender(name: string): void {
  counts.set(name, (counts.get(name) ?? 0) + 1)
}

export function renderCounts(): Record<string, number> {
  return Object.fromEntries(counts)
}

export function resetRenderCounts(): void {
  counts.clear()
}
