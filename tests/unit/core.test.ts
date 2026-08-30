import { describe, expect, it } from "vitest";

import {
  buildSerpentineSolution,
  presets,
  solvePuzzle,
  validatePuzzle,
  verifySolution,
  type Puzzle,
  type SolveOptions,
} from "../../src/core";

const FIRST_SOLUTION_OPTIONS: SolveOptions = {
  mode: "first",
  maxNodes: 2_000_000,
  maxElapsedMs: 10_000,
  maxTraceEvents: 1_000,
};

const UNIQUE_OPTIONS: SolveOptions = {
  ...FIRST_SOLUTION_OPTIONS,
  mode: "check-unique",
};

function puzzle(size: number, cells: ArrayLike<number>): Puzzle {
  return { size, cells: Int16Array.from(cells) };
}

function assertValidNumbrix(input: Puzzle, solution: ArrayLike<number>): void {
  const total = input.size * input.size;
  expect(solution.length).toBe(total);

  const positions = new Int16Array(total + 1);
  positions.fill(-1);
  const seen = new Set<number>();
  for (let index = 0; index < total; index += 1) {
    const value = Number(solution[index]);
    expect(value).toBeGreaterThanOrEqual(1);
    expect(value).toBeLessThanOrEqual(total);
    expect(seen.has(value)).toBe(false);
    seen.add(value);
    positions[value] = index;

    if (input.cells[index]! !== 0) {
      expect(value).toBe(input.cells[index]!);
    }
  }

  expect(seen.size).toBe(total);
  for (let value = 1; value < total; value += 1) {
    const left = positions[value]!;
    const right = positions[value + 1]!;
    const distance =
      Math.abs(Math.floor(left / input.size) - Math.floor(right / input.size)) +
      Math.abs((left % input.size) - (right % input.size));
    expect(distance, `${value} and ${value + 1} must be orthogonal neighbors`).toBe(1);
  }
}

describe("puzzle validation", () => {
  it("accepts empty, single-clue, and endpoint-free puzzles", () => {
    const cases = [
      puzzle(3, new Int16Array(9)),
      puzzle(3, [0, 0, 0, 0, 5, 0, 0, 0, 0]),
      puzzle(3, [0, 0, 0, 6, 0, 4, 0, 0, 0]),
    ];

    for (const input of cases) {
      expect(validatePuzzle(input).ok).toBe(true);
    }
  });

  it.each<{ label: string; input: Puzzle }>([
    { label: "unsupported size", input: puzzle(2, [0, 0, 0, 0]) },
    { label: "wrong cell count", input: puzzle(3, new Int16Array(8)) },
    { label: "duplicate clue", input: puzzle(3, [1, 1, 0, 0, 0, 0, 0, 0, 0]) },
    { label: "out-of-range clue", input: puzzle(3, [10, 0, 0, 0, 0, 0, 0, 0, 0]) },
    { label: "distance conflict", input: puzzle(3, [1, 0, 2, 0, 0, 0, 0, 0, 0]) },
    { label: "parity conflict", input: puzzle(3, [1, 3, 0, 0, 0, 0, 0, 0, 0]) },
  ])("rejects $label", ({ input }) => {
    const validation = validatePuzzle(input);
    expect(validation.ok).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);

    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    expect(result.status).toBe("invalid");
    expect(result.solution).toBeNull();
  });
});

describe("solution verification", () => {
  it("independently accepts a valid solution and rejects invalid boards", () => {
    const solution = buildSerpentineSolution(3);
    const input = puzzle(3, [1, 0, 0, 0, 5, 0, 0, 0, 9]);
    expect(verifySolution(input, solution).ok).toBe(true);

    const clueViolation = Int16Array.from(solution);
    clueViolation[0] = 2;
    clueViolation[1] = 1;
    expect(verifySolution(input, clueViolation).ok).toBe(false);

    const duplicate = Int16Array.from(solution);
    duplicate[0] = duplicate[1]!;
    expect(verifySolution(puzzle(3, new Int16Array(9)), duplicate).ok).toBe(false);
  });
});

describe("solver completeness and outcomes", () => {
  it("solves empty, one-clue, and endpoint-free 3x3 boards", () => {
    const cases = [
      puzzle(3, new Int16Array(9)),
      puzzle(3, [0, 0, 0, 0, 5, 0, 0, 0, 0]),
      puzzle(3, [0, 0, 0, 6, 0, 4, 0, 0, 0]),
    ];

    for (const input of cases) {
      const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
      expect(result.status).toBe("solved");
      expect(result.uniqueness).toBe("unchecked");
      if (!result.solution) {
        throw new Error("A solved result must contain a solution");
      }
      assertValidNumbrix(input, result.solution);
      expect(verifySolution(input, result.solution).ok).toBe(true);
    }
  });

  it("distinguishes unique and ambiguous puzzles", () => {
    const ambiguous = puzzle(3, new Int16Array(9));
    const ambiguousResult = solvePuzzle(ambiguous, UNIQUE_OPTIONS);
    expect(ambiguousResult.status).toBe("solved");
    expect(ambiguousResult.uniqueness).toBe("multiple");
    expect(ambiguousResult.solution).not.toBeNull();
    expect(ambiguousResult.secondSolution).not.toBeNull();
    if (ambiguousResult.solution && ambiguousResult.secondSolution) {
      assertValidNumbrix(ambiguous, ambiguousResult.solution);
      assertValidNumbrix(ambiguous, ambiguousResult.secondSolution);
      expect(Array.from(ambiguousResult.secondSolution)).not.toEqual(
        Array.from(ambiguousResult.solution),
      );
    }

    const complete = puzzle(3, buildSerpentineSolution(3));
    const uniqueResult = solvePuzzle(complete, UNIQUE_OPTIONS);
    expect(uniqueResult.status).toBe("solved");
    expect(uniqueResult.uniqueness).toBe("unique");
    expect(uniqueResult.secondSolution).toBeNull();
  });

  it("proves a locally feasible but impossible puzzle unsatisfiable", () => {
    const input = puzzle(3, [2, 1, 0, 3, 0, 0, 0, 0, 0]);
    expect(validatePuzzle(input).ok).toBe(true);

    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    expect(result.status).toBe("unsatisfiable");
    expect(result.stopReason).toBe("search-exhausted");
    expect(result.solution).toBeNull();
  });

  it("reports a resource limit without claiming unsatisfiability", () => {
    const result = solvePuzzle(puzzle(5, new Int16Array(25)), {
      ...FIRST_SOLUTION_OPTIONS,
      maxNodes: 1,
    });
    expect(result.status).toBe("limit-reached");
    expect(result.stopReason).toBe("node-limit");
    expect(result.solution).toBeNull();
  });

  it("preserves a found solution when uniqueness proof reaches its limit", () => {
    const input = puzzle(3, new Int16Array(9));
    const result = solvePuzzle(input, {
      ...UNIQUE_OPTIONS,
      maxNodes: 5,
    });
    expect(result.status).toBe("solved");
    expect(result.uniqueness).toBe("unknown");
    expect(result.stopReason).toBe("node-limit");
    expect(result.secondSolution).toBeNull();
    if (!result.solution) {
      throw new Error("The partial uniqueness result must retain its first solution");
    }
    assertValidNumbrix(input, result.solution);
  });

  it("honors cooperative cancellation without claiming a search result", () => {
    const result = solvePuzzle(puzzle(5, new Int16Array(25)), {
      ...FIRST_SOLUTION_OPTIONS,
      shouldCancel: () => true,
    });
    expect(result.status).toBe("cancelled");
    expect(result.stopReason).toBe("cancelled");
    expect(result.solution).toBeNull();
  });

  it("records bounded, truthful algorithm-explainer snapshots", () => {
    const result = solvePuzzle(puzzle(3, new Int16Array(9)), {
      ...UNIQUE_OPTIONS,
      maxTraceEvents: 1_000,
    });

    expect(result.status).toBe("solved");
    expect(result.trace[0]?.kind).toBe("initialization");
    expect(result.trace[0]?.explainer).toMatchObject({
      phase: "initialize-domains",
      codeLine: "seed-candidate-domains",
      branchDepth: 0,
    });

    const selection = result.trace.find((event) => event.kind === "selection");
    expect(selection?.explainer.phase).toBe("select-variable");
    expect(selection?.explainer.codeLine).toBe("select-minimum-domain");
    expect(selection?.explainer.activeValue).toBe(selection?.value);
    expect(selection?.explainer.candidateCount).toBe(
      (selection?.explainer.candidateCells.length ?? 0) +
        (selection?.explainer.candidatesOmitted ?? 0),
    );

    const decision = result.trace.find((event) => event.kind === "decision");
    expect(decision?.explainer.phase).toBe("try-candidate");
    expect(decision?.explainer.activeValue).toBe(decision?.value);
    expect(decision?.explainer.activeCell).toBe(decision?.cell);
    expect(decision?.explainer.candidateCount).toBe(1);
    expect(decision?.explainer.candidateCells).toEqual([decision?.cell]);
    expect(decision?.explainer.branchDepth).toBe(decision?.depth);
    expect(decision?.explainer.branchStack.at(-1)).toMatchObject({
      depth: decision?.depth,
      value: decision?.value,
      cell: decision?.cell,
    });
    expect(decision?.explainer.changedCandidateCount).toBeGreaterThan(0);

    const propagation = result.trace.find(
      (event) => event.kind === "propagation" && event.depth > 0,
    );
    expect(propagation?.explainer.phase).toBe("propagate-constraints");
    expect(propagation?.explainer.worklist).toMatchObject({
      strategy: "fixpoint-scan",
    });
    expect(propagation?.explainer.worklist.passes).toBeGreaterThan(0);
    expect(propagation?.explainer.worklist.adjacencyCandidatesChecked).toBeGreaterThan(0);

    const backtrack = result.trace.find((event) => event.kind === "backtrack");
    expect(backtrack?.explainer.phase).toBe("undo-branch");
    expect(backtrack?.explainer.branchDepth).toBe((backtrack?.depth ?? 1) - 1);
    expect(backtrack?.explainer.domainDeltas.every((delta) => delta.operation === "restore"))
      .toBe(true);
    expect(backtrack?.explainer.changedCandidateCount).toBeGreaterThan(0);

    expect(result.trace.some((event) => event.kind === "solution")).toBe(true);
    expect(result.trace.at(-1)?.kind).toBe("terminal");

    for (const event of result.trace) {
      const state = event.explainer;
      expect(state.reasonDetail.length).toBeGreaterThan(0);
      expect(state.candidateCells.length).toBeLessThanOrEqual(16);
      expect(state.candidateCount).toBe(
        state.candidateCells.length + state.candidatesOmitted,
      );
      expect(state.branchStack.length).toBeLessThanOrEqual(12);
      expect(state.branchDepth).toBe(state.branchStack.length + state.branchesOmitted);
      expect(state.domainDeltas.length).toBeLessThanOrEqual(8);
      for (const delta of state.domainDeltas) {
        expect(delta.cells.length).toBeLessThanOrEqual(6);
        expect(Math.abs(delta.beforeSize - delta.afterSize)).toBe(
          delta.cells.length + delta.cellsOmitted,
        );
        if (delta.operation === "remove") expect(delta.beforeSize).toBeGreaterThan(delta.afterSize);
        else expect(delta.afterSize).toBeGreaterThan(delta.beforeSize);
      }
    }
  });

  it("explains the constraint that caused a contradiction", () => {
    const input = puzzle(3, [2, 1, 0, 3, 0, 0, 0, 0, 0]);
    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    const contradiction = result.trace.find((event) => event.kind === "contradiction");

    expect(result.status).toBe("unsatisfiable");
    expect(contradiction?.explainer.phase).toBe("detect-contradiction");
    expect(contradiction?.explainer.reasonDetail.length).toBeGreaterThan(0);
    expect(contradiction?.reason).toBe("constraint-failed");
  });

  it("caps trace storage without changing the solution", () => {
    const regression = puzzle(5, [
      1, 2, 0, 0, 5,
      0, 0, 8, 7, 0,
      11, 0, 13, 14, 0,
      20, 19, 0, 17, 0,
      21, 0, 23, 0, 25,
    ]);
    const result = solvePuzzle(regression, {
      ...FIRST_SOLUTION_OPTIONS,
      maxTraceEvents: 4,
    });
    const withoutRecording = solvePuzzle(regression, {
      ...FIRST_SOLUTION_OPTIONS,
      maxTraceEvents: 0,
    });

    expect(result.status).toBe("solved");
    expect(result.trace.length).toBeLessThanOrEqual(4);
    expect(result.metrics.traceEvents).toBeLessThanOrEqual(4);
    expect(result.metrics.traceTruncated).toBe(true);
    expect(result.metrics.nodes).toBe(withoutRecording.metrics.nodes);
    expect(result.metrics.forcedPlacements).toBe(withoutRecording.metrics.forcedPlacements);
    if (!result.solution) {
      throw new Error("A solved result must contain a solution");
    }
    assertValidNumbrix(regression, result.solution);
    const terminal = result.trace.at(-1);
    expect(terminal?.kind).toBe("terminal");
    expect(result.trace.at(-2)?.kind).toBe("truncated");
    expect(terminal?.explainer.codeLine).toBe("report-search-result");
    expect(Array.from(terminal?.board ?? [])).toEqual(Array.from(result.solution));
  });
});

describe("presets and regressions", () => {
  it("uses the backtracking lab to demonstrate the complete search cycle", () => {
    const preset = presets.find((candidate) => candidate.id === "s5-backtracking-lab");
    if (!preset) throw new Error("Missing backtracking lab preset");

    const input = puzzle(preset.size, preset.cells);
    expect(validatePuzzle(input).ok).toBe(true);
    expect(verifySolution(input, preset.solution).ok).toBe(true);

    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    expect(result.status).toBe("solved");
    if (!result.solution) throw new Error("Backtracking lab did not return a solution");
    assertValidNumbrix(input, result.solution);

    const kinds = result.trace.map((event) => event.kind);
    for (const expected of [
      "selection",
      "decision",
      "contradiction",
      "backtrack",
      "solution",
    ] as const) {
      expect(kinds, `missing ${expected} teaching frame`).toContain(expected);
    }
    expect(kinds.indexOf("contradiction")).toBeLessThan(kinds.indexOf("backtrack"));
    expect(kinds.indexOf("backtrack")).toBeLessThan(kinds.indexOf("solution"));
    expect(result.metrics.nodes).toBe(
      result.trace.filter((event) => event.kind === "decision").length,
    );
    expect(result.metrics.forcedPlacements).toBe(
      result.trace
        .filter((event) => event.kind === "propagation")
        .reduce((count, event) => count + (event.placements?.length ?? 0), 0),
    );
  });

  it(
    "solves and verifies a deterministic preset for every size from 3 through 15",
    () => {
      const expectedSizes = Array.from({ length: 13 }, (_, index) => index + 3);
      expect([...new Set(presets.map((preset) => preset.size))].sort((a, b) => a - b)).toEqual(
        expectedSizes,
      );

      for (const size of expectedSizes) {
        const preset = presets.find((candidate) => candidate.size === size);
        if (!preset) {
          throw new Error(`Missing ${size}x${size} preset`);
        }
        const input = puzzle(preset.size, preset.cells);
        expect(validatePuzzle(input).ok, preset.id).toBe(true);
        expect(verifySolution(input, preset.solution).ok, preset.id).toBe(true);

        const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
        expect(result.status, preset.id).toBe("solved");
        if (!result.solution) {
          throw new Error(`${preset.id} did not return its solution`);
        }
        assertValidNumbrix(input, result.solution);
      }
    },
    60_000,
  );

  it("solves the legacy 5x5 segment 2-to-5 omission regression", () => {
    const input = puzzle(5, [
      1, 2, 0, 0, 5,
      0, 0, 8, 7, 0,
      11, 0, 13, 14, 0,
      20, 19, 0, 17, 0,
      21, 0, 23, 0, 25,
    ]);
    expect(verifySolution(input, buildSerpentineSolution(5)).ok).toBe(true);

    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    expect(result.status).toBe("solved");
    if (!result.solution) {
      throw new Error("The regression puzzle did not return a solution");
    }
    assertValidNumbrix(input, result.solution);
  });

  it("solves the sparse 7x7 fixture without truncated-path consensus", () => {
    const cells = new Int16Array(49);
    cells[0] = 1;
    cells[48] = 49;
    const input = puzzle(7, cells);

    const result = solvePuzzle(input, FIRST_SOLUTION_OPTIONS);
    expect(result.status).toBe("solved");
    if (!result.solution) {
      throw new Error("The sparse 7x7 regression did not return a solution");
    }
    assertValidNumbrix(input, result.solution);
  });
});
