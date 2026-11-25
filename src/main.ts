import {
  presets,
  validatePuzzle,
  type Puzzle,
  type PuzzlePreset,
  type SolveResult,
  type SolverMetrics,
  type TraceEvent,
} from "./core";
import {
  createNumbrixView,
  type CellVisualState,
  type TraceEventKind as UiTraceEventKind,
} from "./ui";
import { SolverClient } from "./worker/client";

const view = createNumbrixView(document);
const solver = new SolverClient();

let puzzle = clonePuzzle(selectInitialPreset());
let result: SolveResult | null = null;
let trace: TraceEvent[] = [];
let traceIndex = 0;
let playbackSpeed = 8;
let playbackTimer: number | null = null;
let activePresetId: string | null = null;

function clonePuzzle(source: Puzzle): Puzzle {
  return { size: source.size, cells: new Int16Array(source.cells) };
}

function selectInitialPreset(): PuzzlePreset {
  return presets.find((preset) => preset.size === 5) ?? presets[0]!;
}

function givenCells(): Uint8Array {
  const given = new Uint8Array(puzzle.cells.length);
  for (let cell = 0; cell < puzzle.cells.length; cell += 1) {
    if (puzzle.cells[cell]! > 0) given[cell] = 1;
  }
  return given;
}

function resetSolveState(nextPuzzle: Puzzle, render = true): void {
  solver.cancel();
  stopPlayback(false);
  puzzle = clonePuzzle(nextPuzzle);
  result = null;
  trace = [];
  traceIndex = 0;
  view.setBusy(false);
  view.setInputError();
  view.setMetrics();
  view.setTraceAvailable(false);
  view.refs.resultActions.hidden = true;
  if (render) {
    view.renderGrid(puzzle, { mode: "edit", given: givenCells() });
  }
}

function loadPreset(presetId: string): void {
  const selected = presets.find((preset) => preset.id === presetId);
  if (!selected) return;
  activePresetId = selected.id;
  resetSolveState(selected);
  view.refs.preset.value = selected.id;
  view.refs.loadPreset.disabled = false;
  view.setPresetDescription(selected.description);
  view.setStatus("idle", `${selected.label}.`);
}

function forgetPresetSelection(): void {
  if (!activePresetId) return;
  activePresetId = null;
  view.refs.preset.value = "";
  view.refs.loadPreset.disabled = true;
  view.setPresetDescription("Custom puzzle. Enter clues directly or paste another grid.");
}

function presentMetrics(metrics: SolverMetrics, events: readonly TraceEvent[]): void {
  view.setMetrics({
    ...metrics,
    forcedMoves: metrics.forcedPlacements,
    traceEvents: events.length,
  });
}

function startSolve(requestPuzzle: Puzzle, options: Parameters<SolverClient["solve"]>[1]): void {
  stopPlayback(false);
  const validation = validatePuzzle(requestPuzzle);
  if (!validation.ok) {
    resetSolveState(requestPuzzle, false);
    view.setResult({
      status: "invalid",
      uniqueness: "unchecked",
      errors: validation.errors,
      hasSolution: false,
      hasTrace: false,
    });
    return;
  }

  puzzle = clonePuzzle(requestPuzzle);
  result = null;
  trace = [];
  traceIndex = 0;
  view.setInputError();
  view.setMetrics();
  view.setTraceAvailable(false);
  view.setBusy(true, `Searching the ${puzzle.size} × ${puzzle.size} board…`);

  solver.solve(puzzle, options, {
    onProgress(metrics, batch) {
      trace.push(...batch);
      presentMetrics(metrics, trace);
    },
    onResult(solveResult) {
      result = solveResult;
      trace = solveResult.trace.slice();
      traceIndex = 0;
      view.setBusy(false);
      view.setResult(solveResult);
      presentMetrics(solveResult.metrics, trace);
      if (trace.length > 0) {
        renderTraceFrame(0);
      } else if (solveResult.status === "solved" && solveResult.solution) {
        renderSolution();
      } else {
        view.renderGrid(puzzle, { mode: "edit", given: givenCells() });
        if (solveResult.status === "invalid") {
          const invalidCells = solveResult.errors.flatMap((error) => error.cells);
          view.setInputError(
            solveResult.errors.map((error) => error.message).join(" "),
            invalidCells,
          );
        }
      }
    },
    onError(message) {
      result = null;
      trace = [];
      view.setBusy(false);
      view.renderGrid(puzzle, { mode: "edit", given: givenCells() });
      view.setStatus("failed", "The solver stopped unexpectedly.", message);
      view.setTraceAvailable(false);
    },
  });
}

function renderSolution(): void {
  if (!result?.solution) return;
  const states: CellVisualState[] = Array.from(
    { length: result.solution.length },
    (_, cell) => (puzzle.cells[cell]! > 0 ? "empty" : "solution"),
  );
  view.renderGrid(
    { size: result.size, cells: new Int16Array(result.solution) },
    { mode: "solution", given: givenCells(), states },
  );
  const terminalIndex = trace.length - 1;
  const terminalEvent = trace[terminalIndex];
  if (terminalEvent) {
    traceIndex = terminalIndex;
    presentTraceMetadata(terminalEvent, terminalIndex);
  } else {
    view.setExplainerSnapshot();
  }
}

function boardAtFrame(index: number): Int16Array {
  const safeIndex = Math.max(0, Math.min(trace.length - 1, index));
  for (let cursor = safeIndex; cursor >= 0; cursor -= 1) {
    const board = trace[cursor]?.board;
    if (board) return new Int16Array(board);
  }
  return new Int16Array(puzzle.cells);
}

function statesForFrame(event: TraceEvent, board: Int16Array): CellVisualState[] {
  const states: CellVisualState[] = Array.from({ length: board.length }, () => "empty");

  for (const cell of event.explainer.candidateCells) {
    if (cell >= 0 && cell < states.length) states[cell] = "candidate";
  }
  for (const delta of event.explainer.domainDeltas) {
    if (delta.value !== event.explainer.activeValue) continue;
    const state: CellVisualState = delta.operation === "restore" ? "restored" : "removed";
    for (const cell of delta.cells) {
      if (cell >= 0 && cell < states.length) states[cell] = state;
    }
  }

  const activeCell = event.cell ?? event.explainer.activeCell;
  if (event.kind === "propagation") {
    for (const placement of event.placements ?? []) states[placement.cell] = "forced";
  } else if (event.kind === "decision" && activeCell !== undefined) {
    states[activeCell] = "decision";
  } else if (event.kind === "contradiction" && activeCell !== undefined) {
    states[activeCell] = "rejected";
  } else if (event.kind === "backtrack" && activeCell !== undefined) {
    states[activeCell] = "backtracked";
  } else if (event.kind === "solution" || (event.kind === "terminal" && result?.solution)) {
    for (let cell = 0; cell < board.length; cell += 1) {
      if (puzzle.cells[cell]! === 0 && board[cell]! > 0) states[cell] = "solution";
    }
  }
  return states;
}

function formatTraceDetail(event: TraceEvent): string {
  const fields = [
    `step ${event.step + 1}`,
    event.kind.replaceAll("-", " "),
    `depth ${event.depth}`,
  ];
  if (event.value !== undefined) fields.push(`value ${event.value}`);
  if (event.cell !== undefined) {
    fields.push(`r${Math.floor(event.cell / puzzle.size) + 1} c${(event.cell % puzzle.size) + 1}`);
  }
  fields.push(event.explainer.codeLine.replaceAll("-", " "));
  return fields.join(" · ");
}

function presentTraceMetadata(event: TraceEvent, index: number): void {
  view.setTraceState({
    index,
    total: trace.length,
    kind: event.kind as UiTraceEventKind,
    depth: event.depth,
    value: event.value,
    cell: event.cell,
    detail: formatTraceDetail(event),
    playing: playbackTimer !== null,
    truncated: Boolean(result?.metrics.traceTruncated),
  });
  // setTraceState supplies compatibility fallbacks. Apply the solver's exact
  // snapshot last so the board, pseudocode, domains, scan, and stack agree.
  view.setExplainerSnapshot(event.explainer);
}

function renderTraceFrame(index: number): void {
  if (trace.length === 0) return;
  traceIndex = Math.max(0, Math.min(trace.length - 1, Math.trunc(index)));
  const event = trace[traceIndex]!;
  const board = boardAtFrame(traceIndex);
  if (view.refs.boardGrid.querySelectorAll(".board-cell").length !== board.length) {
    view.renderGrid(
      { size: puzzle.size, cells: board },
      { mode: "trace", given: givenCells(), states: statesForFrame(event, board) },
    );
  } else {
    view.setBoardMode("trace");
    view.setGivenCells(givenCells());
    view.setCellValues(board);
    view.setCellStates(statesForFrame(event, board));
  }
  presentTraceMetadata(event, traceIndex);
}

function stopPlayback(refresh = true): void {
  if (playbackTimer !== null) {
    window.clearTimeout(playbackTimer);
    playbackTimer = null;
  }
  if (refresh && trace.length > 0 && view.refs.replayTrace.getAttribute("aria-pressed") === "true") {
    renderTraceFrame(traceIndex);
  }
}

function schedulePlayback(): void {
  if (playbackTimer === null) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const effectiveSpeed = reducedMotion ? Math.min(4, playbackSpeed) : playbackSpeed;
  playbackTimer = window.setTimeout(() => {
    if (traceIndex >= trace.length - 1) {
      stopPlayback();
      return;
    }
    traceIndex += 1;
    renderTraceFrame(traceIndex);
    schedulePlayback();
  }, Math.round(1_000 / Math.max(1, effectiveSpeed)));
}

function startPlayback(): void {
  if (trace.length <= 1) return;
  stopPlayback(false);
  if (traceIndex >= trace.length - 1) traceIndex = 0;
  playbackTimer = window.setTimeout(() => undefined, 0);
  renderTraceFrame(traceIndex);
  schedulePlayback();
}

view.setPresets(
  presets.map((preset) => ({
    id: preset.id,
    name: preset.label,
    size: preset.size,
    description: preset.description,
  })),
  selectInitialPreset().id,
);
loadPreset(selectInitialPreset().id);

const unsubscribe = view.on({
  presetLoad: loadPreset,
  puzzleChange(nextPuzzle) {
    puzzle = clonePuzzle(nextPuzzle);
    result = null;
    trace = [];
    traceIndex = 0;
    stopPlayback(false);
    view.setInputError();
    view.setTraceAvailable(false);
    view.refs.resultActions.hidden = true;
    forgetPresetSelection();
  },
  solve(request) {
    startSolve(request.puzzle, request.options);
  },
  cancel() {
    if (!solver.cancel()) return;
    stopPlayback(false);
    result = null;
    trace = [];
    view.setBusy(false);
    view.renderGrid(puzzle, { mode: "edit", given: givenCells() });
    view.setResult({
      status: "cancelled",
      uniqueness: "unknown",
      hasSolution: false,
      hasTrace: false,
      message: "Solve cancelled.",
      detail: "",
    });
  },
  modeChange(mode) {
    if (mode === "solution") {
      stopPlayback(false);
      renderSolution();
    } else if (mode === "trace" && trace.length > 0) {
      stopPlayback(false);
      renderTraceFrame(traceIndex);
    }
  },
  traceSeek(index) {
    stopPlayback(false);
    renderTraceFrame(index);
  },
  traceStep(delta) {
    stopPlayback(false);
    renderTraceFrame(traceIndex + delta);
  },
  tracePlay: startPlayback,
  tracePause() {
    stopPlayback();
  },
  speedChange(speed) {
    playbackSpeed = speed;
    if (playbackTimer !== null) {
      stopPlayback(false);
      startPlayback();
    }
  },
  layersChange() {
    if (trace.length > 0 && view.refs.replayTrace.getAttribute("aria-pressed") === "true") {
      renderTraceFrame(traceIndex);
    }
  },
});

window.addEventListener("beforeunload", () => {
  stopPlayback(false);
  solver.dispose();
  unsubscribe();
  view.destroy();
});
