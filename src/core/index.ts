export { buildSerpentineSolution, getPresetsForSize, presets } from "./presets";
export { solvePuzzle } from "./solver";
export { validatePuzzle, verifySolution } from "./validation";
export type {
  Puzzle,
  PuzzlePreset,
  SolveMetrics,
  SolveMode,
  SolveOptions,
  SolveProgress,
  SolveResult,
  SolveStatus,
  SolveStopReason,
  SolverMetrics,
  TraceAlgorithmPhase,
  TraceBranchFrame,
  TraceCodeLine,
  TraceDomainDelta,
  TraceEvent,
  TraceExplainerSnapshot,
  TraceEventKind,
  TracePlacement,
  TraceWorklistSummary,
  Uniqueness,
  ValidationIssue,
  ValidationIssueCode,
  ValidationResult,
} from "./types";
