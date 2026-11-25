import type { PuzzlePreset } from "./types";

interface PresetConfig {
  size: number;
  interval: number;
  offset: number;
}

export function buildSerpentineSolution(size: number): Int16Array {
  const cells = new Int16Array(size * size);
  let value = 1;
  for (let row = 0; row < size; row += 1) {
    if ((row & 1) === 0) {
      for (let col = 0; col < size; col += 1) cells[row * size + col] = value++;
    } else {
      for (let col = size - 1; col >= 0; col -= 1) cells[row * size + col] = value++;
    }
  }
  return cells;
}

function createPreset(config: PresetConfig): PuzzlePreset {
  const { size, interval, offset } = config;
  const total = size * size;
  const solution = buildSerpentineSolution(size);
  const cells = new Int16Array(total);
  const clueValues = new Set<number>([
    1,
    size,
    Math.ceil(total / 4),
    Math.ceil(total / 2),
    Math.ceil((3 * total) / 4),
    total - size + 1,
    total,
  ]);

  for (let value = 1; value <= total; value += 1) {
    if ((value + offset) % interval === 0) clueValues.add(value);
  }
  for (let cell = 0; cell < total; cell += 1) {
    if (clueValues.has(solution[cell]!)) cells[cell] = solution[cell]!;
  }

  return {
    id: `s${size}-serpentine`,
    label: `${size}×${size} snake`,
    description: `${clueValues.size} clues.`,
    size,
    cells,
    solution,
  };
}

function createBacktrackingLabPreset(): PuzzlePreset {
  return {
    id: "s5-backtracking-lab",
    label: "Backtracking example",
    description: "",
    size: 5,
    cells: Int16Array.from([
      0, 0, 0, 0, 1,
      0, 25, 0, 0, 0,
      0, 0, 0, 18, 3,
      10, 0, 20, 0, 0,
      0, 0, 0, 6, 0,
    ]),
    solution: Int16Array.from([
      13, 14, 15, 16, 1,
      12, 25, 24, 17, 2,
      11, 22, 23, 18, 3,
      10, 21, 20, 19, 4,
      9, 8, 7, 6, 5,
    ]),
  };
}

const legacyIntervals = new Map<number, [number, number]>([
  [5, [3, 1]],
  [7, [4, 2]],
  [9, [5, 3]],
  [11, [6, 4]],
  [13, [7, 5]],
  [15, [8, 6]],
]);

export const presets: readonly PuzzlePreset[] = Object.freeze(
  [
    createBacktrackingLabPreset(),
    ...Array.from({ length: 13 }, (_, index) => index + 3).map((size) => {
      const legacy = legacyIntervals.get(size);
      return createPreset({
        size,
        interval: legacy?.[0] ?? Math.max(2, Math.floor(size / 2)),
        offset: legacy?.[1] ?? (size % Math.max(2, Math.floor(size / 2))),
      });
    }),
  ],
);

export function getPresetsForSize(size: number): readonly PuzzlePreset[] {
  return presets.filter((preset) => preset.size === size);
}
