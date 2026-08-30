import type {
  Puzzle,
  SolveMode,
  SolveResult,
  SolverMetrics,
  TraceEvent,
} from "../core";

export interface WorkerSolveOptions {
  mode: SolveMode;
  maxNodes: number;
  maxElapsedMs: number;
  maxTraceEvents: number;
}

export interface SolveRequestMessage {
  type: "solve";
  requestId: number;
  puzzle: Puzzle;
  options: WorkerSolveOptions;
}

export type SolverWorkerInbound = SolveRequestMessage;

export interface SolverProgressMessage {
  type: "progress";
  requestId: number;
  metrics: SolverMetrics;
  trace: TraceEvent[];
}

export interface SolverResultMessage {
  type: "result";
  requestId: number;
  result: SolveResult;
}

export interface SolverFailureMessage {
  type: "failure";
  requestId: number;
  message: string;
}

export type SolverWorkerOutbound =
  | SolverProgressMessage
  | SolverResultMessage
  | SolverFailureMessage;
