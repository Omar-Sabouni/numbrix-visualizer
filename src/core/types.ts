export interface Puzzle {
  size: number;
  cells: Int16Array;
}

export type SolveMode = "first" | "check-unique";

export type SolveStatus =
  | "invalid"
  | "solved"
  | "unsatisfiable"
  | "limit-reached"
  | "cancelled";

export type Uniqueness = "unchecked" | "unique" | "multiple" | "unknown";

export type SolveStopReason =
  | "validation"
  | "solution-found"
  | "search-exhausted"
  | "node-limit"
  | "time-limit"
  | "cancelled";

export type ValidationIssueCode =
  | "invalid-size"
  | "invalid-shape"
  | "invalid-value"
  | "duplicate-clue"
  | "clue-distance"
  | "clue-parity"
  | "clue-neighbors"
  | "solution-shape"
  | "solution-value"
  | "solution-duplicate"
  | "solution-clue"
  | "solution-adjacency";

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  cells: number[];
  values?: number[];
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  invalidCells: number[];
}

export type TraceEventKind =
  | "initialization"
  | "selection"
  | "propagation"
  | "decision"
  | "contradiction"
  | "backtrack"
  | "solution"
  | "truncated"
  | "terminal";

export type TraceAlgorithmPhase =
  | "initialize-domains"
  | "select-variable"
  | "try-candidate"
  | "propagate-constraints"
  | "detect-contradiction"
  | "undo-branch"
  | "verify-solution"
  | "finish";

export type TraceCodeLine =
  | "seed-candidate-domains"
  | "select-minimum-domain"
  | "assign-candidate"
  | "propagate-singleton-values"
  | "propagate-singleton-cells"
  | "prune-adjacency-support"
  | "check-path-degree"
  | "check-segment-connectivity"
  | "rollback-trail"
  | "verify-complete-board"
  | "trace-cap-reached"
  | "report-search-result";

/** A compact account of the fixpoint scans performed by propagation. */
export interface TraceWorklistSummary {
  strategy: "fixpoint-scan";
  passes: number;
  valueSingletonsProcessed: number;
  cellSingletonsProcessed: number;
  adjacencyCandidatesChecked: number;
  connectivitySegmentsChecked: number;
}

export interface TraceBranchFrame {
  depth: number;
  value: number;
  cell: number;
  candidateIndex: number;
  candidateCount: number;
}

export interface TraceDomainDelta {
  value: number;
  operation: "remove" | "restore";
  beforeSize: number;
  afterSize: number;
  /** A bounded preview of affected cells. */
  cells: number[];
  cellsOmitted: number;
}

/**
 * Bounded state for an algorithm-explainer view. Counts are exact; arrays are
 * previews so traces remain practical for 15x15 boards.
 */
export interface TraceExplainerSnapshot {
  phase: TraceAlgorithmPhase;
  codeLine: TraceCodeLine;
  activeValue?: number;
  activeCell?: number;
  candidateCount: number;
  candidateCells: number[];
  candidatesOmitted: number;
  worklist: TraceWorklistSummary;
  branchDepth: number;
  branchStack: TraceBranchFrame[];
  branchesOmitted: number;
  domainDeltas: TraceDomainDelta[];
  changedCandidateCount: number;
  /** Number of distinct changed value domains omitted from domainDeltas. */
  deltasOmitted: number;
  reasonDetail: string;
}

export interface TracePlacement {
  value: number;
  cell: number;
}

export interface TraceEvent {
  kind: TraceEventKind;
  step: number;
  depth: number;
  explainer: TraceExplainerSnapshot;
  value?: number;
  cell?: number;
  reason?: string;
  board?: Int16Array;
  placements?: TracePlacement[];
}

export interface SolverMetrics {
  /** Number of candidate decisions tried. */
  nodes: number;
  /** Compatibility alias for older consumers. */
  expandedNodes: number;
  backtracks: number;
  /** Number of domain candidates removed by constraint propagation. */
  propagations: number;
  /** Number of values that became fixed during propagation (not branch choices). */
  forcedPlacements: number;
  maxDepth: number;
  elapsedMs: number;
  solutionsFound: number;
  traceEvents: number;
  traceTruncated: boolean;
}

export type SolveMetrics = SolverMetrics;

export interface SolveProgress {
  metrics: SolverMetrics;
  trace: TraceEvent[];
}

export interface SolveOptions {
  mode?: SolveMode;
  maxNodes?: number;
  maxElapsedMs?: number;
  maxTraceEvents?: number;
  onProgress?: (metrics: SolverMetrics, trace: TraceEvent[]) => void;
  onTrace?: (event: TraceEvent) => void;
  shouldCancel?: () => boolean;
}

export interface SolveResult {
  size: number;
  status: SolveStatus;
  uniqueness: Uniqueness;
  solution: Int16Array | null;
  secondSolution: Int16Array | null;
  metrics: SolverMetrics;
  trace: TraceEvent[];
  errors: ValidationIssue[];
  stopReason: SolveStopReason;
  initialCells: Int16Array;
}

export interface PuzzlePreset extends Puzzle {
  id: string;
  label: string;
  description: string;
  solution: Int16Array;
}
