import { areNeighbors, getTopology, manhattan, type Topology } from "./topology";
import type {
  Puzzle,
  ValidationIssue,
  ValidationResult,
} from "./types";

interface Clue {
  value: number;
  cell: number;
}

function result(errors: ValidationIssue[], invalidCells: Set<number>): ValidationResult {
  return {
    ok: errors.length === 0,
    errors,
    invalidCells: [...invalidCells].sort((left, right) => left - right),
  };
}

export function collectClues(cells: ArrayLike<number>, total: number): Clue[] {
  const clues: Clue[] = [];
  const limit = Math.min(cells.length, total);
  for (let cell = 0; cell < limit; cell += 1) {
    const value = Number(cells[cell]);
    if (Number.isInteger(value) && value > 0 && value <= total) {
      clues.push({ value, cell });
    }
  }
  return clues;
}

export function cellMatchesClueBounds(
  value: number,
  cell: number,
  clues: readonly Clue[],
  topology: Topology,
): boolean {
  for (const clue of clues) {
    const steps = Math.abs(value - clue.value);
    const distance = manhattan(topology, cell, clue.cell);
    if (distance > steps || ((steps - distance) & 1) !== 0) {
      return false;
    }
  }
  return true;
}

export function validatePuzzle(puzzle: Puzzle): ValidationResult {
  const errors: ValidationIssue[] = [];
  const invalidCells = new Set<number>();
  const size = Number(puzzle?.size);

  if (!Number.isInteger(size) || size < 3 || size > 15) {
    errors.push({
      code: "invalid-size",
      message: "Board size must be an integer from 3 through 15.",
      cells: [],
    });
    return result(errors, invalidCells);
  }

  const total = size * size;
  if (!puzzle.cells || puzzle.cells.length !== total) {
    errors.push({
      code: "invalid-shape",
      message: `A ${size}x${size} puzzle must contain exactly ${total} cells.`,
      cells: [],
    });
    return result(errors, invalidCells);
  }

  const topology = getTopology(size);
  const valueToCell = new Int16Array(total + 1);
  valueToCell.fill(-1);

  for (let cell = 0; cell < total; cell += 1) {
    const value = Number(puzzle.cells[cell]);
    if (!Number.isInteger(value) || value < 0 || value > total) {
      errors.push({
        code: "invalid-value",
        message: `Cell values must be blank (0) or integers from 1 through ${total}.`,
        cells: [cell],
        values: [value],
      });
      invalidCells.add(cell);
      continue;
    }
    if (value === 0) continue;

    const priorCell = valueToCell[value]!;
    if (priorCell >= 0) {
      errors.push({
        code: "duplicate-clue",
        message: `Clue ${value} appears more than once.`,
        cells: [priorCell, cell],
        values: [value],
      });
      invalidCells.add(priorCell);
      invalidCells.add(cell);
    } else {
      valueToCell[value] = cell;
    }
  }

  const clues: Clue[] = [];
  for (let value = 1; value <= total; value += 1) {
    const cell = valueToCell[value]!;
    if (cell >= 0) clues.push({ value, cell });
  }

  for (let leftIndex = 0; leftIndex < clues.length; leftIndex += 1) {
    const left = clues[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < clues.length; rightIndex += 1) {
      const right = clues[rightIndex]!;
      const steps = right.value - left.value;
      const distance = manhattan(topology, left.cell, right.cell);
      if (distance > steps) {
        errors.push({
          code: "clue-distance",
          message: `Clues ${left.value} and ${right.value} are too far apart.`,
          cells: [left.cell, right.cell],
          values: [left.value, right.value],
        });
        invalidCells.add(left.cell);
        invalidCells.add(right.cell);
      } else if (((steps - distance) & 1) !== 0) {
        errors.push({
          code: "clue-parity",
          message: `Clues ${left.value} and ${right.value} can't connect: a ${steps}-step path can't join cells ${distance} steps apart.`,
          cells: [left.cell, right.cell],
          values: [left.value, right.value],
        });
        invalidCells.add(left.cell);
        invalidCells.add(right.cell);
      }
    }
  }

  const occupied = new Uint8Array(total);
  for (const clue of clues) occupied[clue.cell] = 1;

  const candidatesBeside = (targetValue: number, centerCell: number): number[] => {
    const fixedCell = valueToCell[targetValue]!;
    if (fixedCell >= 0) {
      return areNeighbors(topology, fixedCell, centerCell) ? [fixedCell] : [];
    }
    const candidates: number[] = [];
    for (const neighbor of topology.neighbors[centerCell]!) {
      if (occupied[neighbor] === 0 && cellMatchesClueBounds(targetValue, neighbor, clues, topology)) {
        candidates.push(neighbor);
      }
    }
    return candidates;
  };

  for (const clue of clues) {
    const before = clue.value > 1 ? candidatesBeside(clue.value - 1, clue.cell) : null;
    const after = clue.value < total ? candidatesBeside(clue.value + 1, clue.cell) : null;
    let feasible = before === null || before.length > 0;
    feasible = feasible && (after === null || after.length > 0);
    if (feasible && before && after) {
      feasible = before.some((left) => after.some((right) => left !== right));
    }
    if (!feasible) {
      errors.push({
        code: "clue-neighbors",
        message: `Clue ${clue.value} has no free neighboring cell for ${[clue.value > 1 ? clue.value - 1 : null, clue.value < total ? clue.value + 1 : null].filter((value) => value !== null).join(" or ")}.`,
        cells: [clue.cell],
        values: [clue.value],
      });
      invalidCells.add(clue.cell);
    }
  }

  return result(errors, invalidCells);
}

export function verifySolution(
  puzzle: Puzzle,
  candidate: ArrayLike<number> | Puzzle = puzzle.cells,
): ValidationResult {
  const puzzleValidation = validatePuzzle(puzzle);
  if (!puzzleValidation.ok) return puzzleValidation;

  const errors: ValidationIssue[] = [];
  const invalidCells = new Set<number>();
  const total = puzzle.size * puzzle.size;
  const candidateCells = "cells" in candidate ? candidate.cells : candidate;

  if (candidateCells.length !== total) {
    errors.push({
      code: "solution-shape",
      message: `A solution must contain exactly ${total} cells.`,
      cells: [],
    });
    return result(errors, invalidCells);
  }

  const valueToCell = new Int16Array(total + 1);
  valueToCell.fill(-1);
  for (let cell = 0; cell < total; cell += 1) {
    const value = Number(candidateCells[cell]);
    if (!Number.isInteger(value) || value < 1 || value > total) {
      errors.push({
        code: "solution-value",
        message: `Every solution cell must contain an integer from 1 through ${total}.`,
        cells: [cell],
        values: [value],
      });
      invalidCells.add(cell);
      continue;
    }
    const priorCell = valueToCell[value]!;
    if (priorCell >= 0) {
      errors.push({
        code: "solution-duplicate",
        message: `Solution value ${value} appears more than once.`,
        cells: [priorCell, cell],
        values: [value],
      });
      invalidCells.add(priorCell);
      invalidCells.add(cell);
    } else {
      valueToCell[value] = cell;
    }

    const clue = Number(puzzle.cells[cell]);
    if (clue > 0 && value !== clue) {
      errors.push({
        code: "solution-clue",
        message: `The solution changes clue ${clue}.`,
        cells: [cell],
        values: [clue, value],
      });
      invalidCells.add(cell);
    }
  }

  const topology = getTopology(puzzle.size);
  for (let value = 1; value < total; value += 1) {
    const left = valueToCell[value]!;
    const right = valueToCell[value + 1]!;
    if (left >= 0 && right >= 0 && !areNeighbors(topology, left, right)) {
      errors.push({
        code: "solution-adjacency",
        message: `Values ${value} and ${value + 1} are not orthogonal neighbors.`,
        cells: [left, right],
        values: [value, value + 1],
      });
      invalidCells.add(left);
      invalidCells.add(right);
    }
  }

  return result(errors, invalidCells);
}
