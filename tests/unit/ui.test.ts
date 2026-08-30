import { describe, expect, it } from "vitest";

import { formatPuzzleGrid, parsePastedGrid } from "../../src/ui";

describe("puzzle text import and export", () => {
  it("parses mixed separators and empty-cell markers", () => {
    const parsed = parsePastedGrid("1, 2, 3\n6 . 4\n7\t8\t9");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.puzzle.size).toBe(3);
    expect(Array.from(parsed.puzzle.cells)).toEqual([1, 2, 3, 6, 0, 4, 7, 8, 9]);
    expect(formatPuzzleGrid(parsed.puzzle)).toBe("1\t2\t3\n6\t0\t4\n7\t8\t9");
  });

  it("infers a flat square and reports malformed rows", () => {
    const flat = parsePastedGrid("1 2 3 6 5 4 7 8 9");
    expect(flat.ok && flat.puzzle.size).toBe(3);

    const malformed = parsePastedGrid("1 2 3\n4 5\n6 7 8");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error).toContain("Row 2");
  });
});
