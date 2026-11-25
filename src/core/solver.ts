import { getTopology, type Topology } from "./topology";
import type {
  Puzzle,
  SolveMode,
  SolveOptions,
  SolveResult,
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
} from "./types";
import {
  cellMatchesClueBounds,
  collectClues,
  validatePuzzle,
  verifySolution,
} from "./validation";

const DEFAULT_MAX_NODES = 2_000_000;
const DEFAULT_MAX_ELAPSED_MS = 10_000;
const DEFAULT_MAX_TRACE_EVENTS = 20_000;
const CANDIDATE_PREVIEW_LIMIT = 16;
const BRANCH_PREVIEW_LIMIT = 12;
const DOMAIN_DELTA_LIMIT = 8;
const DELTA_CELL_PREVIEW_LIMIT = 6;

type PropagationResult = "ok" | "contradiction" | "stopped";

interface PropagationOutcome {
  result: PropagationResult;
  worklist: TraceWorklistSummary;
  codeLine: TraceCodeLine;
  reasonDetail: string;
  activeValue?: number;
  activeCell?: number;
}

interface ExplainerContext {
  phase: TraceAlgorithmPhase;
  codeLine: TraceCodeLine;
  activeValue?: number;
  activeCell?: number;
  candidateCells?: readonly number[];
  candidateCount?: number;
  worklist?: TraceWorklistSummary;
  domainDeltas?: TraceDomainDelta[];
  changedCandidateCount?: number;
  deltasOmitted?: number;
  reasonDetail: string;
}

interface NormalizedOptions {
  mode: SolveMode;
  maxNodes: number;
  maxElapsedMs: number;
  maxTraceEvents: number;
  onProgress?: SolveOptions["onProgress"];
  onTrace?: SolveOptions["onTrace"];
  shouldCancel?: SolveOptions["shouldCancel"];
}

function limit(value: number | undefined, fallback: number): number {
  if (value === Number.POSITIVE_INFINITY) return value;
  return Number.isFinite(value) && value! >= 0 ? Math.floor(value!) : fallback;
}

function normalizeOptions(options: SolveOptions | undefined): NormalizedOptions {
  return {
    mode: options?.mode === "check-unique" ? "check-unique" : "first",
    maxNodes: limit(options?.maxNodes, DEFAULT_MAX_NODES),
    maxElapsedMs: limit(options?.maxElapsedMs, DEFAULT_MAX_ELAPSED_MS),
    maxTraceEvents: limit(options?.maxTraceEvents, DEFAULT_MAX_TRACE_EVENTS),
    onProgress: options?.onProgress,
    onTrace: options?.onTrace,
    shouldCancel: options?.shouldCancel,
  };
}

function emptyMetrics(): SolverMetrics {
  return {
    nodes: 0,
    expandedNodes: 0,
    backtracks: 0,
    propagations: 0,
    forcedPlacements: 0,
    maxDepth: 0,
    elapsedMs: 0,
    solutionsFound: 0,
    traceEvents: 0,
    traceTruncated: false,
  };
}

function copyMetrics(metrics: SolverMetrics, elapsedMs: number): SolverMetrics {
  return { ...metrics, elapsedMs };
}

function buildPreferredPath(puzzle: Puzzle): Int16Array {
  const { size } = puzzle;
  const total = size * size;
  const base = new Int16Array(total + 1);
  let value = 1;
  for (let row = 0; row < size; row += 1) {
    if ((row & 1) === 0) {
      for (let col = 0; col < size; col += 1) base[value++] = row * size + col;
    } else {
      for (let col = size - 1; col >= 0; col -= 1) base[value++] = row * size + col;
    }
  }

  const transform = (cell: number, variant: number): number => {
    const row = Math.floor(cell / size);
    const col = cell % size;
    let transformedRow = row;
    let transformedCol = col;
    switch (variant) {
      case 1:
        transformedCol = size - 1 - col;
        break;
      case 2:
        transformedRow = size - 1 - row;
        break;
      case 3:
        transformedRow = size - 1 - row;
        transformedCol = size - 1 - col;
        break;
      case 4:
        transformedRow = col;
        transformedCol = row;
        break;
      case 5:
        transformedRow = col;
        transformedCol = size - 1 - row;
        break;
      case 6:
        transformedRow = size - 1 - col;
        transformedCol = row;
        break;
      case 7:
        transformedRow = size - 1 - col;
        transformedCol = size - 1 - row;
        break;
      default:
        break;
    }
    return transformedRow * size + transformedCol;
  };

  let bestScore = -1;
  let bestVariant = 0;
  let bestReversed = false;
  for (let variant = 0; variant < 8; variant += 1) {
    for (const reversed of [false, true]) {
      let score = 0;
      for (let pathValue = 1; pathValue <= total; pathValue += 1) {
        const sourceValue = reversed ? total + 1 - pathValue : pathValue;
        const cell = transform(base[sourceValue]!, variant);
        if (puzzle.cells[cell] === pathValue) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant;
        bestReversed = reversed;
      }
    }
  }

  const preferred = new Int16Array(total + 1);
  for (let pathValue = 1; pathValue <= total; pathValue += 1) {
    const sourceValue = bestReversed ? total + 1 - pathValue : pathValue;
    preferred[pathValue] = transform(base[sourceValue]!, bestVariant);
  }
  return preferred;
}

export function solvePuzzle(puzzle: Puzzle, options?: SolveOptions): SolveResult {
  const startedAt = Date.now();
  const settings = normalizeOptions(options);
  const validation = validatePuzzle(puzzle);
  const metrics = emptyMetrics();
  const initialCells = puzzle?.cells ? new Int16Array(puzzle.cells) : new Int16Array();

  if (!validation.ok) {
    metrics.elapsedMs = Date.now() - startedAt;
    return {
      size: Number.isInteger(puzzle?.size) ? puzzle.size : 0,
      status: "invalid",
      uniqueness: "unchecked",
      solution: null,
      secondSolution: null,
      metrics,
      trace: [],
      errors: validation.errors,
      stopReason: "validation",
      initialCells,
    };
  }

  const topology = getTopology(puzzle.size);
  const total = topology.total;
  const words = Math.ceil(total / 32);
  const domains = new Uint32Array((total + 1) * words);
  const domainSizes = new Int16Array(total + 1);
  const trail: number[] = [];
  const clues = collectClues(puzzle.cells, total);
  const clueCells = new Int16Array(total + 1);
  clueCells.fill(-1);
  for (const clue of clues) clueCells[clue.value] = clue.cell;

  const wordIndex = (value: number, cell: number): number => value * words + (cell >>> 5);
  const bitMask = (cell: number): number => (1 << (cell & 31)) >>> 0;
  const hasCandidate = (value: number, cell: number): boolean =>
    (domains[wordIndex(value, cell)]! & bitMask(cell)) !== 0;

  const addInitialCandidate = (value: number, cell: number): void => {
    const index = wordIndex(value, cell);
    domains[index] = (domains[index]! | bitMask(cell)) >>> 0;
    domainSizes[value] = domainSizes[value]! + 1;
  };

  for (let candidateValue = 1; candidateValue <= total; candidateValue += 1) {
    const fixedCell = clueCells[candidateValue]!;
    if (fixedCell >= 0) {
      addInitialCandidate(candidateValue, fixedCell);
      continue;
    }
    for (let cell = 0; cell < total; cell += 1) {
      if (puzzle.cells[cell] !== 0) continue;
      if (cellMatchesClueBounds(candidateValue, cell, clues, topology)) {
        addInitialCandidate(candidateValue, cell);
      }
    }
  }

  const removeCandidate = (value: number, cell: number, propagated: boolean): boolean => {
    const index = wordIndex(value, cell);
    const mask = bitMask(cell);
    if ((domains[index]! & mask) === 0) return false;
    domains[index] = (domains[index]! & ~mask) >>> 0;
    domainSizes[value] = domainSizes[value]! - 1;
    trail.push(value * total + cell);
    if (propagated) metrics.propagations += 1;
    return true;
  };

  const rollback = (marker: number): void => {
    while (trail.length > marker) {
      const encoded = trail.pop()!;
      const value = Math.floor(encoded / total);
      const cell = encoded - value * total;
      const index = wordIndex(value, cell);
      domains[index] = (domains[index]! | bitMask(cell)) >>> 0;
      domainSizes[value] = domainSizes[value]! + 1;
    }
  };

  const singletonCell = (value: number): number => {
    if (domainSizes[value] !== 1) return -1;
    const offset = value * words;
    for (let word = 0; word < words; word += 1) {
      const bits = domains[offset + word]!;
      if (bits !== 0) {
        const lowestBit = (bits & -bits) >>> 0;
        return word * 32 + (31 - Math.clz32(lowestBit));
      }
    }
    return -1;
  };

  const snapshot = (): Int16Array => {
    const board = new Int16Array(total);
    for (let assignedValue = 1; assignedValue <= total; assignedValue += 1) {
      const cell = singletonCell(assignedValue);
      if (cell >= 0 && cell < total) board[cell] = assignedValue;
    }
    return board;
  };

  const diffPlacements = (before: Int16Array, after: Int16Array): TracePlacement[] => {
    const placements: TracePlacement[] = [];
    for (let cell = 0; cell < total; cell += 1) {
      if (after[cell] !== 0 && after[cell] !== before[cell]) {
        placements.push({ value: after[cell]!, cell });
      }
    }
    return placements;
  };

  const emptyWorklist = (): TraceWorklistSummary => ({
    strategy: "fixpoint-scan",
    passes: 0,
    valueSingletonsProcessed: 0,
    cellSingletonsProcessed: 0,
    adjacencyCandidatesChecked: 0,
    connectivitySegmentsChecked: 0,
  });

  const branchStack: TraceBranchFrame[] = [];

  const currentCandidates = (value: number): number[] => {
    const candidates: number[] = [];
    for (let cell = 0; cell < total; cell += 1) {
      if (hasCandidate(value, cell)) candidates.push(cell);
    }
    return candidates;
  };

  const summarizeTrailChanges = (
    start: number,
    end: number,
    operation: TraceDomainDelta["operation"],
    capture = true,
  ): { domainDeltas: TraceDomainDelta[]; changedCandidateCount: number; deltasOmitted: number } => {
    if (!capture) {
      return {
        domainDeltas: [],
        changedCandidateCount: end - start,
        deltasOmitted: 0,
      };
    }
    const groups = new Map<number, { count: number; cells: number[] }>();
    for (let index = start; index < end; index += 1) {
      const encoded = trail[index]!;
      const value = Math.floor(encoded / total);
      const cell = encoded - value * total;
      let group = groups.get(value);
      if (!group) {
        group = { count: 0, cells: [] };
        groups.set(value, group);
      }
      group.count += 1;
      if (group.cells.length < DELTA_CELL_PREVIEW_LIMIT) group.cells.push(cell);
    }

    const domainDeltas: TraceDomainDelta[] = [];
    for (const [value, group] of groups) {
      if (domainDeltas.length >= DOMAIN_DELTA_LIMIT) break;
      const currentSize = domainSizes[value]!;
      domainDeltas.push({
        value,
        operation,
        beforeSize: operation === "remove" ? currentSize + group.count : currentSize,
        afterSize: operation === "remove" ? currentSize : currentSize + group.count,
        cells: group.cells,
        cellsOmitted: group.count - group.cells.length,
      });
    }

    return {
      domainDeltas,
      changedCandidateCount: end - start,
      deltasOmitted: Math.max(0, groups.size - domainDeltas.length),
    };
  };

  const buildExplainer = (context: ExplainerContext): TraceExplainerSnapshot => {
    const allCandidates =
      context.candidateCells ??
      (context.activeValue === undefined ? [] : currentCandidates(context.activeValue));
    const candidateCount = context.candidateCount ?? allCandidates.length;
    const candidateCells = Array.from(allCandidates).slice(0, CANDIDATE_PREVIEW_LIMIT);
    const visibleBranches = branchStack.slice(-BRANCH_PREVIEW_LIMIT).map((frame) => ({
      ...frame,
    }));
    return {
      phase: context.phase,
      codeLine: context.codeLine,
      activeValue: context.activeValue,
      activeCell: context.activeCell,
      candidateCount,
      candidateCells,
      candidatesOmitted: Math.max(0, candidateCount - candidateCells.length),
      worklist: context.worklist ? { ...context.worklist } : emptyWorklist(),
      branchDepth: branchStack.length,
      branchStack: visibleBranches,
      branchesOmitted: Math.max(0, branchStack.length - visibleBranches.length),
      domainDeltas: context.domainDeltas?.map((delta) => ({
        ...delta,
        cells: [...delta.cells],
      })) ?? [],
      changedCandidateCount: context.changedCandidateCount ?? 0,
      deltasOmitted: context.deltasOmitted ?? 0,
      reasonDetail: context.reasonDetail,
    };
  };

  const trace: TraceEvent[] = [];
  const progressTrace: TraceEvent[] = [];
  const regularTraceCapacity = Math.max(0, settings.maxTraceEvents - 2);
  const storeTrace = (
    kind: TraceEventKind,
    depth: number,
    context: ExplainerContext,
    detail: Omit<TraceEvent, "kind" | "step" | "depth" | "explainer"> = {},
    force = false,
  ): void => {
    if (!force && trace.length >= regularTraceCapacity) {
      metrics.traceTruncated = true;
      return;
    }
    if (trace.length >= settings.maxTraceEvents) {
      metrics.traceTruncated = true;
      return;
    }
    const event: TraceEvent = {
      kind,
      step: trace.length,
      depth,
      explainer: buildExplainer(context),
      ...detail,
    };
    trace.push(event);
    progressTrace.push(event);
    settings.onTrace?.(event);
  };

  let lastProgressAt = startedAt;
  const reportProgress = (force = false): void => {
    if (!settings.onProgress) return;
    const now = Date.now();
    if (!force && metrics.nodes % 256 !== 0 && now - lastProgressAt < 100) return;
    const batch = progressTrace.splice(0, progressTrace.length);
    settings.onProgress(copyMetrics(metrics, now - startedAt), batch);
    lastProgressAt = now;
  };

  let stopReason: SolveStopReason | null = null;
  let terminateSearch = false;

  const checkResourceLimits = (): boolean => {
    if (terminateSearch) return true;
    if (settings.shouldCancel?.()) {
      stopReason = "cancelled";
      terminateSearch = true;
      return true;
    }
    if (Date.now() - startedAt >= settings.maxElapsedMs) {
      stopReason = "time-limit";
      terminateSearch = true;
      return true;
    }
    return false;
  };

  const assign = (value: number, cell: number): void => {
    for (let otherCell = 0; otherCell < total; otherCell += 1) {
      if (otherCell !== cell) removeCandidate(value, otherCell, false);
    }
  };

  const hasAdjacentSupport = (value: number, cell: number): boolean => {
    for (const neighbor of topology.neighbors[cell]!) {
      if (hasCandidate(value, neighbor)) return true;
    }
    return false;
  };

  const singletonHasDistinctSides = (value: number, cell: number): boolean => {
    if (value <= 1 || value >= total) return true;
    for (const before of topology.neighbors[cell]!) {
      if (!hasCandidate(value - 1, before)) continue;
      for (const after of topology.neighbors[cell]!) {
        if (after !== before && hasCandidate(value + 1, after)) return true;
      }
    }
    return false;
  };

  const singletonSegmentsRemainConnected = (
    worklist: TraceWorklistSummary,
  ): {
    ok: boolean;
    reasonDetail: string;
    activeValue?: number;
    activeCell?: number;
  } => {
    let lowerValue = -1;
    for (let upperValue = 1; upperValue <= total; upperValue += 1) {
      if (domainSizes[upperValue] !== 1) continue;
      if (lowerValue < 0) {
        lowerValue = upperValue;
        continue;
      }

      worklist.connectivitySegmentsChecked += 1;
      const gap = upperValue - lowerValue;
      const start = singletonCell(lowerValue);
      const goal = singletonCell(upperValue);
      const allowed = new Uint8Array(total);
      let allowedCount = 0;
      for (let value = lowerValue; value <= upperValue; value += 1) {
        for (let cell = 0; cell < total; cell += 1) {
          if (allowed[cell] === 0 && hasCandidate(value, cell)) {
            allowed[cell] = 1;
            allowedCount += 1;
          }
        }
      }
      if (allowedCount < gap + 1) {
        return {
          ok: false,
          reasonDetail: `${lowerValue} to ${upperValue} needs ${gap + 1} cells, but only ${allowedCount} are left. Dead end.`,
          activeValue: upperValue,
          activeCell: goal,
        };
      }

      const distance = new Int16Array(total);
      distance.fill(-1);
      const queue = new Int16Array(total);
      let head = 0;
      let tail = 0;
      let reachableCount = 1;
      queue[tail++] = start;
      distance[start] = 0;
      while (head < tail) {
        const cell = queue[head++]!;
        for (const neighbor of topology.neighbors[cell]!) {
          if (allowed[neighbor] === 0 || distance[neighbor] !== -1) continue;
          distance[neighbor] = distance[cell]! + 1;
          queue[tail++] = neighbor;
          reachableCount += 1;
        }
      }
      if (distance[goal]! < 0 || distance[goal]! > gap || reachableCount < gap + 1) {
        return {
          ok: false,
          reasonDetail: `${lowerValue} and ${upperValue} can't be joined in ${gap} steps. Dead end.`,
          activeValue: upperValue,
          activeCell: goal,
        };
      }
      lowerValue = upperValue;
    }
    return {
      ok: true,
      reasonDetail: `All ${worklist.connectivitySegmentsChecked} runs can still join up.`,
    };
  };

  const propagate = (): PropagationOutcome => {
    const worklist = emptyWorklist();
    const outcome = (
      result: PropagationResult,
      codeLine: TraceCodeLine,
      reasonDetail: string,
      activeValue?: number,
      activeCell?: number,
    ): PropagationOutcome => ({
      result,
      worklist,
      codeLine,
      reasonDetail,
      activeValue,
      activeCell,
    });
    let changed = true;
    while (changed) {
      if (checkResourceLimits()) {
        return outcome(
          "stopped",
          "report-search-result",
          "Propagation stopped because the search resource limit was reached.",
        );
      }
      worklist.passes += 1;
      changed = false;

      for (let value = 1; value <= total; value += 1) {
        if (domainSizes[value] === 0) {
          return outcome(
            "contradiction",
            "propagate-singleton-values",
            `Value ${value} has no remaining candidate cell.`,
            value,
          );
        }
        if (domainSizes[value] !== 1) continue;
        worklist.valueSingletonsProcessed += 1;
        const cell = singletonCell(value);
        for (let otherValue = 1; otherValue <= total; otherValue += 1) {
          if (otherValue !== value && removeCandidate(otherValue, cell, true)) {
            changed = true;
            if (domainSizes[otherValue] === 0) {
              return outcome(
                "contradiction",
                "propagate-singleton-values",
                `Fixing ${value} in this cell leaves value ${otherValue} with no candidate.`,
                otherValue,
                cell,
              );
            }
          }
        }
      }

      for (let cell = 0; cell < total; cell += 1) {
        let owner = 0;
        let ownerCount = 0;
        for (let value = 1; value <= total; value += 1) {
          if (hasCandidate(value, cell)) {
            owner = value;
            ownerCount += 1;
          }
        }
        if (ownerCount === 0) {
          return outcome(
            "contradiction",
            "propagate-singleton-cells",
            "This cell cannot contain any remaining value.",
            undefined,
            cell,
          );
        }
        if (ownerCount === 1 && domainSizes[owner] !== 1) {
          worklist.cellSingletonsProcessed += 1;
          const before = domainSizes[owner]!;
          assign(owner, cell);
          metrics.propagations += before - 1;
          changed = true;
        }
      }

      for (let value = 1; value <= total; value += 1) {
        for (let cell = 0; cell < total; cell += 1) {
          if (!hasCandidate(value, cell)) continue;
          worklist.adjacencyCandidatesChecked += 1;
          const beforeSupported = value === 1 || hasAdjacentSupport(value - 1, cell);
          const afterSupported = value === total || hasAdjacentSupport(value + 1, cell);
          if ((!beforeSupported || !afterSupported) && removeCandidate(value, cell, true)) {
            changed = true;
            if (domainSizes[value] === 0) {
              const missingSide = !beforeSupported ? value - 1 : value + 1;
              return outcome(
                "contradiction",
                "prune-adjacency-support",
                `Every cell for value ${value} lacks an orthogonal candidate for ${missingSide}.`,
                value,
                cell,
              );
            }
          }
        }
      }

      for (let value = 2; value < total; value += 1) {
        if (domainSizes[value] === 1) {
          const cell = singletonCell(value);
          if (!singletonHasDistinctSides(value, cell)) {
            return outcome(
              "contradiction",
              "check-path-degree",
              `Fixed value ${value} cannot connect to distinct cells for ${value - 1} and ${value + 1}.`,
              value,
              cell,
            );
          }
        }
      }
    }
    const connectivity = singletonSegmentsRemainConnected(worklist);
    if (!connectivity.ok) {
      return outcome(
        "contradiction",
        "check-segment-connectivity",
        connectivity.reasonDetail,
        connectivity.activeValue,
        connectivity.activeCell,
      );
    }
    return outcome(
      "ok",
      "check-segment-connectivity",
      `Filled in everything forced, in ${worklist.passes} ${worklist.passes === 1 ? "pass" : "passes"}. ${connectivity.reasonDetail}`,
    );
  };

  const preferredCells = buildPreferredPath(puzzle);
  const selectValue = (): number => {
    let selected = -1;
    let selectedSize = total + 1;
    for (let value = 1; value <= total; value += 1) {
      const size = domainSizes[value]!;
      if (size > 1 && size < selectedSize) {
        selected = value;
        selectedSize = size;
      }
    }
    return selected;
  };

  const candidateScore = (value: number, cell: number): number => {
    let score = preferredCells[value] === cell ? 1_000_000 : 0;
    if (value > 1) {
      for (const neighbor of topology.neighbors[cell]!) {
        if (hasCandidate(value - 1, neighbor)) score += 100;
      }
    }
    if (value < total) {
      for (const neighbor of topology.neighbors[cell]!) {
        if (hasCandidate(value + 1, neighbor)) score += 100;
      }
    }
    let competingValues = 0;
    for (let otherValue = 1; otherValue <= total; otherValue += 1) {
      if (otherValue !== value && hasCandidate(otherValue, cell)) competingValues += 1;
    }
    return score - competingValues;
  };

  const orderedCandidates = (value: number): number[] => {
    const candidates: number[] = [];
    for (let cell = 0; cell < total; cell += 1) {
      if (hasCandidate(value, cell)) candidates.push(cell);
    }
    candidates.sort((left, right) => {
      const difference = candidateScore(value, right) - candidateScore(value, left);
      return difference || left - right;
    });
    return candidates;
  };

  const solutions: Int16Array[] = [];

  const search = (depth: number): void => {
    if (checkResourceLimits()) return;
    const value = selectValue();
    if (value === -1) {
      const completed = snapshot();
      if (!verifySolution(puzzle, completed).ok) return;
      if (!solutions.some((solution) => solution.every((cell, index) => cell === completed[index]))) {
        solutions.push(completed);
        metrics.solutionsFound = solutions.length;
        storeTrace(
          "solution",
          depth,
          {
            phase: "verify-solution",
            codeLine: "verify-complete-board",
            reasonDetail:
              solutions.length === 1
                ? "Every number is placed and each one touches the next."
                : "Found a second solution.",
          },
          {
            reason: solutions.length === 1 ? "first-solution" : "second-solution",
            board: new Int16Array(completed),
          },
        );
      }
      if (settings.mode === "first" || solutions.length >= 2) {
        stopReason = "solution-found";
        terminateSearch = true;
      }
      return;
    }

    const candidates = orderedCandidates(value);
    storeTrace(
      "selection",
      depth,
      {
        phase: "select-variable",
        codeLine: "select-minimum-domain",
        activeValue: value,
        candidateCells: candidates,
        candidateCount: candidates.length,
        reasonDetail: `${value} has the fewest places left: ${candidates.length}.`,
      },
      {
        value,
        reason: "minimum-remaining-values",
        board: snapshot(),
      },
    );

    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      const cell = candidates[candidateIndex]!;
      if (checkResourceLimits()) return;
      if (metrics.nodes >= settings.maxNodes) {
        stopReason = "node-limit";
        terminateSearch = true;
        return;
      }

      metrics.nodes += 1;
      metrics.expandedNodes = metrics.nodes;
      metrics.maxDepth = Math.max(metrics.maxDepth, depth + 1);
      const marker = trail.length;
      const beforeDecision = snapshot();
      assign(value, cell);
      const decisionBoard = snapshot();
      const decisionChanges = summarizeTrailChanges(
        marker,
        trail.length,
        "remove",
        trace.length < regularTraceCapacity,
      );
      branchStack.push({
        depth: depth + 1,
        value,
        cell,
        candidateIndex,
        candidateCount: candidates.length,
      });
      storeTrace(
        "decision",
        depth + 1,
        {
          phase: "try-candidate",
          codeLine: "assign-candidate",
          activeValue: value,
          activeCell: cell,
          candidateCells: [cell],
          candidateCount: 1,
          domainDeltas: decisionChanges.domainDeltas,
          changedCandidateCount: decisionChanges.changedCandidateCount,
          deltasOmitted: decisionChanges.deltasOmitted,
          reasonDetail: `Guess ${candidateIndex + 1} of ${candidates.length}: put ${value} here.`,
        },
        {
          value,
          cell,
          reason: "minimum-remaining-values",
          board: decisionBoard,
          placements: diffPlacements(beforeDecision, decisionBoard),
        },
      );

      const beforePropagation = decisionBoard;
      const propagationMarker = trail.length;
      const propagated = propagate();
      const afterPropagation = snapshot();
      const placements = diffPlacements(beforePropagation, afterPropagation);
      metrics.forcedPlacements += placements.length;
      const propagationChanges = summarizeTrailChanges(
        propagationMarker,
        trail.length,
        "remove",
        trace.length < regularTraceCapacity,
      );
      storeTrace(
        "propagation",
        depth + 1,
        {
          phase: "propagate-constraints",
          codeLine: propagated.codeLine,
          activeValue: propagated.activeValue ?? value,
          activeCell: propagated.activeCell ?? cell,
          worklist: propagated.worklist,
          domainDeltas: propagationChanges.domainDeltas,
          changedCandidateCount: propagationChanges.changedCandidateCount,
          deltasOmitted: propagationChanges.deltasOmitted,
          reasonDetail: propagated.reasonDetail,
        },
        {
          value: propagated.activeValue ?? value,
          cell: propagated.activeCell ?? cell,
          reason: propagated.result === "contradiction" ? "constraint-failed" : "forced-values",
          board: afterPropagation,
          placements,
        },
      );

      if (propagated.result === "contradiction") {
        storeTrace(
          "contradiction",
          depth + 1,
          {
            phase: "detect-contradiction",
            codeLine: propagated.codeLine,
            activeValue: propagated.activeValue ?? value,
            activeCell: propagated.activeCell ?? cell,
            worklist: propagated.worklist,
            domainDeltas: propagationChanges.domainDeltas,
            changedCandidateCount: propagationChanges.changedCandidateCount,
            deltasOmitted: propagationChanges.deltasOmitted,
            reasonDetail: propagated.reasonDetail,
          },
          {
            value: propagated.activeValue ?? value,
            cell: propagated.activeCell ?? cell,
            reason: "constraint-failed",
            board: afterPropagation,
          },
        );
      }

      if (propagated.result === "ok") search(depth + 1);
      reportProgress();
      if (terminateSearch) return;

      const rollbackChanges = summarizeTrailChanges(
        marker,
        trail.length,
        "restore",
        trace.length < regularTraceCapacity,
      );
      rollback(marker);
      metrics.backtracks += 1;
      branchStack.pop();
      storeTrace(
        "backtrack",
        depth + 1,
        {
          phase: "undo-branch",
          codeLine: "rollback-trail",
          activeValue: value,
          activeCell: cell,
          candidateCells: candidates,
          candidateCount: candidates.length,
          domainDeltas: rollbackChanges.domainDeltas,
          changedCandidateCount: rollbackChanges.changedCandidateCount,
          deltasOmitted: rollbackChanges.deltasOmitted,
          reasonDetail: `That guess failed. Erase it and go back.`,
        },
        {
          value,
          cell,
          reason: propagated.result === "contradiction" ? "constraint-failed" : "dead-end",
          board: snapshot(),
        },
      );
    }
  };

  let initialCandidateCount = 0;
  for (let value = 1; value <= total; value += 1) {
    initialCandidateCount += domainSizes[value]!;
  }
  const initializedBoard = snapshot();
  storeTrace(
    "initialization",
    0,
    {
      phase: "initialize-domains",
      codeLine: "seed-candidate-domains",
      reasonDetail: `Listed where each of the ${total} numbers could go: ${initialCandidateCount} options in all.`,
    },
    {
      reason: "domains-initialized",
      board: initializedBoard,
    },
  );

  const beforeInitialPropagation = initializedBoard;
  const initialPropagationMarker = trail.length;
  const initialPropagation = propagate();
  const afterInitialPropagation = snapshot();
  const initialPlacements = diffPlacements(beforeInitialPropagation, afterInitialPropagation);
  metrics.forcedPlacements += initialPlacements.length;
  const initialChanges = summarizeTrailChanges(
    initialPropagationMarker,
    trail.length,
    "remove",
    trace.length < regularTraceCapacity,
  );
  storeTrace(
    "propagation",
    0,
    {
      phase: "propagate-constraints",
      codeLine: initialPropagation.codeLine,
      activeValue: initialPropagation.activeValue,
      activeCell: initialPropagation.activeCell,
      worklist: initialPropagation.worklist,
      domainDeltas: initialChanges.domainDeltas,
      changedCandidateCount: initialChanges.changedCandidateCount,
      deltasOmitted: initialChanges.deltasOmitted,
      reasonDetail: initialPropagation.reasonDetail,
    },
    {
      value: initialPropagation.activeValue,
      cell: initialPropagation.activeCell,
      reason:
        initialPropagation.result === "contradiction"
          ? "constraint-failed"
          : "initial-constraints",
      board: afterInitialPropagation,
      placements: initialPlacements,
    },
  );
  if (initialPropagation.result === "contradiction") {
    storeTrace(
      "contradiction",
      0,
      {
        phase: "detect-contradiction",
        codeLine: initialPropagation.codeLine,
        activeValue: initialPropagation.activeValue,
        activeCell: initialPropagation.activeCell,
        worklist: initialPropagation.worklist,
        domainDeltas: initialChanges.domainDeltas,
        changedCandidateCount: initialChanges.changedCandidateCount,
        deltasOmitted: initialChanges.deltasOmitted,
        reasonDetail: initialPropagation.reasonDetail,
      },
      {
        value: initialPropagation.activeValue,
        cell: initialPropagation.activeCell,
        reason: "constraint-failed",
        board: afterInitialPropagation,
      },
    );
  } else if (initialPropagation.result === "ok") {
    search(0);
  }

  const resolvedStopReason: SolveStopReason =
    (stopReason as SolveStopReason | null) ??
    (terminateSearch ? "time-limit" : "search-exhausted");
  const elapsedMs = Date.now() - startedAt;
  metrics.elapsedMs = elapsedMs;

  let status: SolveResult["status"];
  let uniqueness: SolveResult["uniqueness"];
  if (resolvedStopReason === "cancelled") {
    status = "cancelled";
    uniqueness = "unknown";
  } else if (solutions.length > 0) {
    status = "solved";
    if (settings.mode === "first") uniqueness = "unchecked";
    else if (solutions.length >= 2) uniqueness = "multiple";
    else if (resolvedStopReason === "search-exhausted") uniqueness = "unique";
    else uniqueness = "unknown";
  } else if (resolvedStopReason === "node-limit" || resolvedStopReason === "time-limit") {
    status = "limit-reached";
    uniqueness = "unknown";
  } else {
    status = "unsatisfiable";
    uniqueness = "unchecked";
  }

  if (metrics.traceTruncated && settings.maxTraceEvents >= 2) {
    storeTrace(
      "truncated",
      metrics.maxDepth,
      {
        phase: "finish",
        codeLine: "trace-cap-reached",
        reasonDetail: `Stopped recording after ${settings.maxTraceEvents} steps. The solver kept going.`,
      },
      { reason: "trace-limit" },
      true,
    );
  }

  const terminalBoard = solutions[0] ? new Int16Array(solutions[0]) : snapshot();
  if (settings.maxTraceEvents >= 1) {
    storeTrace(
      "terminal",
      metrics.maxDepth,
      {
        phase: "finish",
        codeLine: "report-search-result",
        reasonDetail: status === "solved" ? "The grid is complete." : `The search stopped early (${resolvedStopReason.replaceAll("-", " ")}).`,
      },
      { reason: resolvedStopReason, board: terminalBoard },
      true,
    );
  }

  metrics.traceEvents = trace.length;
  metrics.elapsedMs = Date.now() - startedAt;
  reportProgress(true);

  return {
    size: puzzle.size,
    status,
    uniqueness,
    solution: solutions[0] ? new Int16Array(solutions[0]) : null,
    secondSolution: solutions[1] ? new Int16Array(solutions[1]) : null,
    metrics,
    trace,
    errors: [],
    stopReason: resolvedStopReason,
    initialCells,
  };
}
