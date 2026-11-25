import type {
  Puzzle,
  SolveMetrics,
  SolveMode,
  SolveStatus,
  TraceAlgorithmPhase,
  TraceBranchFrame,
  TraceCodeLine,
  TraceDomainDelta,
  TraceExplainerSnapshot,
  TraceWorklistSummary,
  Uniqueness,
} from "../core/types";

export type BoardMode = "edit" | "solution" | "trace";

export type CellVisualState =
  | "empty"
  | "candidate"
  | "forced"
  | "decision"
  | "removed"
  | "restored"
  | "rejected"
  | "backtracked"
  | "solution"
  | "invalid"
  | "current";

export type UiSolveStatus = SolveStatus | "idle" | "solving" | "failed";

export type TraceEventKind =
  | "none"
  | "initialization"
  | "selection"
  | "propagation"
  | "forced"
  | "decision"
  | "contradiction"
  | "backtrack"
  | "rejected"
  | "solution"
  | "truncated"
  | "terminal";

export interface PresetOption {
  id: string;
  name: string;
  size: number;
  description?: string;
}

export interface SolveControlOptions {
  mode: SolveMode;
  maxNodes: number;
  maxElapsedMs: number;
  maxTraceEvents: number;
}

export interface SolveRequest {
  puzzle: Puzzle;
  options: SolveControlOptions;
}

export interface TraceLayerVisibility {
  forced: boolean;
  decisions: boolean;
  rejected: boolean;
  solution: boolean;
}

export interface TracePresentation {
  index: number;
  total: number;
  kind?: TraceEventKind;
  depth?: number;
  value?: number;
  cell?: number;
  detail?: string;
  playing?: boolean;
  truncated?: boolean;
}

/** A value-centric domain: the squares where one path value may still be placed. */
export interface DomainPresentation {
  value?: number;
  activeCell?: number;
  candidateCount: number;
  candidateCells: readonly number[];
  candidatesOmitted?: number;
}

export interface BranchStackPresentation {
  depth: number;
  frames: readonly TraceBranchFrame[];
  omitted?: number;
}

export interface DomainDeltaPresentation {
  activeValue?: number;
  deltas: readonly TraceDomainDelta[];
  changedCandidateCount: number;
  omitted?: number;
}

export interface ResultPresentation {
  size?: number;
  status: SolveStatus;
  uniqueness?: Uniqueness;
  solution?: ArrayLike<number> | null;
  initialCells?: ArrayLike<number>;
  trace?: readonly unknown[];
  metrics?: MetricPresentation;
  hasSolution?: boolean;
  hasTrace?: boolean;
  stopReason?: string;
  errors?: readonly (string | { message: string; cells?: readonly number[] })[];
  message?: string;
  detail?: string;
}

export interface MetricPresentation extends Partial<SolveMetrics> {
  decisions?: number;
  forcedMoves?: number;
}

export interface GridRenderOptions {
  readOnly?: boolean;
  mode?: BoardMode;
  given?: ArrayLike<boolean | number> | ReadonlySet<number>;
  states?: readonly (CellVisualState | undefined)[];
  focusIndex?: number;
}

interface NumbrixViewEventMap {
  sizeChange: number;
  presetLoad: string;
  puzzleChange: Puzzle;
  paste: Puzzle;
  clear: void;
  solve: SolveRequest;
  cancel: void;
  copy: void;
  modeChange: BoardMode;
  traceSeek: number;
  traceStep: -1 | 1;
  tracePlay: void;
  tracePause: void;
  speedChange: number;
  layersChange: TraceLayerVisibility;
}

export type NumbrixViewHandlers = {
  [Key in keyof NumbrixViewEventMap]?: (value: NumbrixViewEventMap[Key]) => void;
};

export interface NumbrixViewRefs {
  boardSize: HTMLSelectElement;
  preset: HTMLSelectElement;
  loadPreset: HTMLButtonElement;
  presetDescription: HTMLElement;
  pastePuzzle: HTMLButtonElement;
  clearBoard: HTMLButtonElement;
  uniqueness: HTMLInputElement;
  maxNodes: HTMLInputElement;
  maxTime: HTMLInputElement;
  maxTrace: HTMLInputElement;
  solve: HTMLButtonElement;
  cancel: HTMLButtonElement;
  resultPanel: HTMLElement;
  statusBadge: HTMLElement;
  statusMessage: HTMLElement;
  statusDetail: HTMLElement;
  inputError: HTMLElement;
  resultActions: HTMLElement;
  showSolution: HTMLButtonElement;
  replayTrace: HTMLButtonElement;
  copySolution: HTMLButtonElement;
  boardViewport: HTMLElement;
  boardGrid: HTMLElement;
  boardModeLabel: HTMLElement;
  boardInstructions: HTMLElement;
  traceKindBadge: HTMLElement;
  traceFirst: HTMLButtonElement;
  tracePrevious: HTMLButtonElement;
  tracePlay: HTMLButtonElement;
  tracePause: HTMLButtonElement;
  traceNext: HTMLButtonElement;
  traceLast: HTMLButtonElement;
  traceScrubber: HTMLInputElement;
  traceCounter: HTMLOutputElement;
  traceSpeed: HTMLInputElement;
  traceSpeedValue: HTMLOutputElement;
  traceDetail: HTMLElement;
  traceTruncated: HTMLElement;
  showForced: HTMLInputElement;
  showDecisions: HTMLInputElement;
  showRejected: HTMLInputElement;
  showSolutionLayer: HTMLInputElement;
  nodesMetric: HTMLElement;
  forcedMetric: HTMLElement;
  solutionsMetric: HTMLElement;
  backtracksMetric: HTMLElement;
  depthMetric: HTMLElement;
  elapsedMetric: HTMLElement;
  traceEventsMetric: HTMLElement;
  algorithmPhase: HTMLElement;
  algorithmCode: HTMLOListElement;
  explanationPanel: HTMLElement;
  algorithmExplanation: HTMLElement;
  domainSummary: HTMLElement;
  domainCandidates: HTMLElement;
  domainDeltas: HTMLElement;
  propagationScan: HTMLElement;
  decisionStack: HTMLOListElement;
  pasteDialog: HTMLDialogElement;
  pasteForm: HTMLFormElement;
  pasteText: HTMLTextAreaElement;
  pasteError: HTMLElement;
  closePaste: HTMLButtonElement;
  cancelPaste: HTMLButtonElement;
  toastRegion: HTMLElement;
}

export interface NumbrixView {
  readonly refs: Readonly<NumbrixViewRefs>;
  on(handlers: NumbrixViewHandlers): () => void;
  destroy(): void;
  getPuzzleInput(): Puzzle;
  getSolveOptions(): SolveControlOptions;
  getLayerVisibility(): TraceLayerVisibility;
  setPresets(presets: readonly PresetOption[], selectedId?: string): void;
  setPresetDescription(description: string): void;
  renderGrid(puzzle: Puzzle, options?: GridRenderOptions): void;
  setCellValues(values: ArrayLike<number>): void;
  setCellStates(states: readonly (CellVisualState | undefined)[]): void;
  setGivenCells(given: ArrayLike<boolean | number> | ReadonlySet<number>): void;
  setGridReadOnly(readOnly: boolean): void;
  setBoardMode(mode: BoardMode): void;
  setBusy(busy: boolean, message?: string): void;
  setStatus(status: UiSolveStatus, message: string, detail?: string): void;
  setResult(result: ResultPresentation): void;
  setInputError(message?: string, invalidCells?: readonly number[]): void;
  setMetrics(metrics?: MetricPresentation): void;
  setTraceState(trace: TracePresentation): void;
  setTraceAvailable(available: boolean, total?: number): void;
  setAlgorithmPhase(phase: TraceAlgorithmPhase): void;
  setActiveCodeLine(codeLine?: TraceCodeLine): void;
  setDomainCandidates(domain?: DomainPresentation): void;
  setPropagationScan(worklist?: TraceWorklistSummary): void;
  setDecisionStack(stack?: BranchStackPresentation): void;
  setDomainDeltas(changes?: DomainDeltaPresentation): void;
  setExplanation(message: string): void;
  setExplainerSnapshot(snapshot?: TraceExplainerSnapshot): void;
  showToast(message: string): void;
}

export type PasteParseResult =
  | { ok: true; puzzle: Puzzle }
  | { ok: false; error: string };

const MIN_SIZE = 3;
const MAX_SIZE = 15;
const DEFAULT_SIZE = 9;

const statusLabels: Record<UiSolveStatus, string> = {
  idle: "Idle",
  solving: "Solving",
  invalid: "Invalid",
  solved: "Solved",
  unsatisfiable: "No solution",
  "limit-reached": "Limit reached",
  cancelled: "Cancelled",
  failed: "Error",
};

const eventLabels: Record<TraceEventKind, string> = {
  none: "No trace",
  initialization: "Initialize",
  selection: "Select value",
  propagation: "Forced",
  forced: "Forced",
  decision: "Decision",
  contradiction: "Contradiction",
  backtrack: "Backtrack",
  rejected: "Rejected",
  solution: "Solution",
  truncated: "Trace capped",
  terminal: "Final state",
};

const phaseLabels: Record<TraceAlgorithmPhase, string> = {
  "initialize-domains": "Initialize domains",
  "select-variable": "Select MRV value",
  "try-candidate": "Try candidate",
  "propagate-constraints": "Fixpoint scan",
  "detect-contradiction": "Contradiction",
  "undo-branch": "Roll back",
  "verify-solution": "Verify path",
  finish: "Finish",
};

const fallbackCodeLine: Partial<Record<TraceEventKind, TraceCodeLine>> = {
  initialization: "seed-candidate-domains",
  selection: "select-minimum-domain",
  propagation: "propagate-singleton-values",
  forced: "propagate-singleton-values",
  decision: "assign-candidate",
  contradiction: "check-path-degree",
  backtrack: "rollback-trail",
  rejected: "rollback-trail",
  solution: "verify-complete-board",
  truncated: "trace-cap-reached",
  terminal: "report-search-result",
};

const fallbackPhase: Partial<Record<TraceEventKind, TraceAlgorithmPhase>> = {
  initialization: "initialize-domains",
  selection: "select-variable",
  propagation: "propagate-constraints",
  forced: "propagate-constraints",
  decision: "try-candidate",
  contradiction: "detect-contradiction",
  backtrack: "undo-branch",
  rejected: "undo-branch",
  solution: "verify-solution",
  truncated: "finish",
  terminal: "finish",
};

const stateDescriptions: Partial<Record<CellVisualState, string>> = {
  candidate: "candidate square for the active value",
  forced: "forced deduction",
  decision: "search decision",
  removed: "candidate removed from a value domain",
  restored: "candidate restored during rollback",
  rejected: "rejected choice",
  backtracked: "backtracked choice",
  solution: "solution path",
  invalid: "invalid clue",
  current: "current trace cell",
};

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Numbrix UI is missing required element: ${selector}`);
  }
  return element;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

function positiveNumber(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(input: HTMLInputElement, fallback: number): number {
  const value = Number(input.value);
  return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : fallback;
}

function formatCount(value: number | undefined): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value ?? 0);
}

function formatElapsed(value: number | undefined): string {
  const elapsed = Math.max(0, value ?? 0);
  if (elapsed < 1_000) return `${Math.round(elapsed)} ms`;
  if (elapsed < 60_000) return `${(elapsed / 1_000).toFixed(elapsed < 10_000 ? 2 : 1)} s`;
  const minutes = Math.floor(elapsed / 60_000);
  return `${minutes}m ${((elapsed % 60_000) / 1_000).toFixed(1)}s`;
}

function isGivenAt(
  given: ArrayLike<boolean | number> | ReadonlySet<number> | undefined,
  index: number,
): boolean {
  if (!given) return false;
  if (typeof (given as ReadonlySet<number>).has === "function") {
    return (given as ReadonlySet<number>).has(index);
  }
  return Boolean((given as ArrayLike<boolean | number>)[index]);
}

function inferSquareSize(cellCount: number): number | undefined {
  const size = Math.sqrt(cellCount);
  return Number.isInteger(size) && size >= MIN_SIZE && size <= MAX_SIZE ? size : undefined;
}

export function parsePastedGrid(text: string, expectedSize?: number): PasteParseResult {
  const source = text.trim();
  if (!source) {
    return { ok: false, error: "Paste at least one row of puzzle values." };
  }

  let rows = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/[\s,;|]+/).filter(Boolean));

  if (rows.length === 1) {
    const flat = rows[0];
    if (!flat) {
      return { ok: false, error: "Paste at least one row of puzzle values." };
    }
    const inferred = inferSquareSize(flat.length);
    if (inferred && inferred !== 1) {
      rows = Array.from({ length: inferred }, (_, row) =>
        flat.slice(row * inferred, (row + 1) * inferred),
      );
    }
  }

  const size = expectedSize ?? rows.length;
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE) {
    return { ok: false, error: "The pasted grid must be between 3 × 3 and 15 × 15." };
  }
  if (rows.length !== size) {
    return {
      ok: false,
      error: `Expected ${size} rows, but found ${rows.length}.`,
    };
  }

  const cells = new Int16Array(size * size);
  for (let row = 0; row < size; row += 1) {
    const tokens = rows[row];
    if (!tokens || tokens.length !== size) {
      return {
        ok: false,
        error: `Row ${row + 1} has ${tokens?.length ?? 0} cells; expected ${size}.`,
      };
    }
    for (let column = 0; column < size; column += 1) {
      const token = tokens[column]!;
      const value = token === "." || token === "_" || token === "-" ? 0 : Number(token);
      if (!Number.isInteger(value) || value < 0 || value > size * size) {
        return {
          ok: false,
          error: `“${token}” at row ${row + 1}, column ${column + 1} is not 0–${size * size}.`,
        };
      }
      cells[row * size + column] = value;
    }
  }

  return { ok: true, puzzle: { size, cells } };
}

export function formatPuzzleGrid(puzzle: Puzzle, empty = "0"): string {
  const rows: string[] = [];
  for (let row = 0; row < puzzle.size; row += 1) {
    const values: string[] = [];
    for (let column = 0; column < puzzle.size; column += 1) {
      const value = puzzle.cells[row * puzzle.size + column] ?? 0;
      values.push(value > 0 ? String(value) : empty);
    }
    rows.push(values.join("\t"));
  }
  return rows.join("\n");
}

export function createNumbrixView(root: ParentNode = document): NumbrixView {
  const refs: NumbrixViewRefs = {
    boardSize: required(root, "#boardSizeSelect"),
    preset: required(root, "#presetSelect"),
    loadPreset: required(root, "#loadPresetBtn"),
    presetDescription: required(root, "#presetDescription"),
    pastePuzzle: required(root, "#pastePuzzleBtn"),
    clearBoard: required(root, "#clearBoardBtn"),
    uniqueness: required(root, "#uniquenessToggle"),
    maxNodes: required(root, "#maxNodesInput"),
    maxTime: required(root, "#maxTimeInput"),
    maxTrace: required(root, "#maxTraceInput"),
    solve: required(root, "#solveBtn"),
    cancel: required(root, "#cancelBtn"),
    resultPanel: required(root, "#resultPanel"),
    statusBadge: required(root, "#statusBadge"),
    statusMessage: required(root, "#statusMessage"),
    statusDetail: required(root, "#statusDetail"),
    inputError: required(root, "#inputError"),
    resultActions: required(root, "#resultActions"),
    showSolution: required(root, "#showSolutionBtn"),
    replayTrace: required(root, "#replayTraceBtn"),
    copySolution: required(root, "#copySolutionBtn"),
    boardViewport: required(root, "#boardViewport"),
    boardGrid: required(root, "#boardGrid"),
    boardModeLabel: required(root, "#boardModeLabel"),
    boardInstructions: required(root, "#boardInstructions"),
    traceKindBadge: required(root, "#traceKindBadge"),
    traceFirst: required(root, "#traceFirstBtn"),
    tracePrevious: required(root, "#tracePreviousBtn"),
    tracePlay: required(root, "#tracePlayBtn"),
    tracePause: required(root, "#tracePauseBtn"),
    traceNext: required(root, "#traceNextBtn"),
    traceLast: required(root, "#traceLastBtn"),
    traceScrubber: required(root, "#traceScrubber"),
    traceCounter: required(root, "#traceCounter"),
    traceSpeed: required(root, "#traceSpeed"),
    traceSpeedValue: required(root, "#traceSpeedValue"),
    traceDetail: required(root, "#traceDetail"),
    traceTruncated: required(root, "#traceTruncated"),
    showForced: required(root, "#showForcedToggle"),
    showDecisions: required(root, "#showDecisionsToggle"),
    showRejected: required(root, "#showRejectedToggle"),
    showSolutionLayer: required(root, "#showSolutionToggle"),
    nodesMetric: required(root, "#nodesMetric"),
    forcedMetric: required(root, "#forcedMetric"),
    solutionsMetric: required(root, "#solutionsMetric"),
    backtracksMetric: required(root, "#backtracksMetric"),
    depthMetric: required(root, "#depthMetric"),
    elapsedMetric: required(root, "#elapsedMetric"),
    traceEventsMetric: required(root, "#traceEventsMetric"),
    algorithmPhase: required(root, "#algorithmPhase"),
    algorithmCode: required(root, "#algorithmCode"),
    explanationPanel: required(root, "#explanationPanel"),
    algorithmExplanation: required(root, "#algorithmExplanation"),
    domainSummary: required(root, "#domainSummary"),
    domainCandidates: required(root, "#domainCandidates"),
    domainDeltas: required(root, "#domainDeltas"),
    propagationScan: required(root, "#propagationScan"),
    decisionStack: required(root, "#decisionStack"),
    pasteDialog: required(root, "#pasteDialog"),
    pasteForm: required(root, "#pasteForm"),
    pasteText: required(root, "#pasteText"),
    pasteError: required(root, "#pasteError"),
    closePaste: required(root, "#closePasteBtn"),
    cancelPaste: required(root, "#cancelPasteBtn"),
    toastRegion: required(root, "#toastRegion"),
  };

  const ownerDocument = (root as Node).ownerDocument ?? (root as Document);
  const subscribers = new Set<NumbrixViewHandlers>();
  const abortController = new AbortController();
  const { signal } = abortController;
  const presetDescriptions = new Map<string, string>();
  let currentSize = clampInteger(Number(refs.boardSize.value) || DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  let gridReadOnly = false;
  let currentMode: BoardMode = "edit";
  let traceTotal = 0;
  let toastTimer: number | undefined;
  let solutionForCopy: Puzzle | undefined;
  let solutionGivens: ArrayLike<number> | undefined;

  function emit<Key extends keyof NumbrixViewEventMap>(
    key: Key,
    value: NumbrixViewEventMap[Key],
  ): void {
    subscribers.forEach((subscriber) => {
      const callback = subscriber[key] as
        | ((payload: NumbrixViewEventMap[Key]) => void)
        | undefined;
      callback?.(value);
    });
  }

  function inputs(): HTMLInputElement[] {
    return Array.from(refs.boardGrid.querySelectorAll<HTMLInputElement>(".board-cell"));
  }

  function slots(): HTMLElement[] {
    return Array.from(refs.boardGrid.querySelectorAll<HTMLElement>(".cell-slot"));
  }

  type PathDirection = "up" | "right" | "down" | "left";

  function pathDirection(from: number, to: number): PathDirection | undefined {
    if (to === from - currentSize) return "up";
    if (to === from + 1 && Math.floor(from / currentSize) === Math.floor(to / currentSize)) {
      return "right";
    }
    if (to === from + currentSize) return "down";
    if (to === from - 1 && Math.floor(from / currentSize) === Math.floor(to / currentSize)) {
      return "left";
    }
    return undefined;
  }

  function oppositeDirection(direction: PathDirection): PathDirection {
    if (direction === "up") return "down";
    if (direction === "right") return "left";
    if (direction === "down") return "up";
    return "right";
  }

  /** Draw only links justified by the board currently on screen.
   *
   * A trace frame can be partial, so this deliberately does not infer missing
   * links from the final solution. Every segment is evidence in the displayed
   * board: value n is orthogonally adjacent to n + 1.
   */
  function updateVisiblePath(): void {
    const boardSlots = slots();
    const positionByValue = new Map<number, number>();
    inputs().forEach((input, index) => {
      const value = Number(input.value);
      if (Number.isInteger(value) && value >= 1 && value <= currentSize * currentSize) {
        positionByValue.set(value, index);
      }
    });

    boardSlots.forEach((slot) => {
      delete slot.dataset.pathIn;
      delete slot.dataset.pathOut;
    });

    for (let value = 1; value < currentSize * currentSize; value += 1) {
      const from = positionByValue.get(value);
      const to = positionByValue.get(value + 1);
      if (from === undefined || to === undefined) continue;
      const direction = pathDirection(from, to);
      if (!direction) continue;
      const fromSlot = boardSlots[from];
      const toSlot = boardSlots[to];
      if (!fromSlot || !toSlot) continue;
      fromSlot.dataset.pathOut = direction;
      toSlot.dataset.pathIn = oppositeDirection(direction);
    }
  }

  function applyReadOnly(): void {
    inputs().forEach((input) => {
      input.readOnly = gridReadOnly;
      input.setAttribute("aria-readonly", String(gridReadOnly));
    });
  }

  function setRovingIndex(index: number, focus = false): void {
    const cells = inputs();
    if (!cells.length) return;
    const safeIndex = clampInteger(index, 0, cells.length - 1);
    cells.forEach((cell, cellIndex) => {
      cell.tabIndex = cellIndex === safeIndex ? 0 : -1;
    });
    if (focus) cells[safeIndex]?.focus({ preventScroll: false });
  }

  function applyStateVisibility(): void {
    const visible = getLayerVisibility();
    slots().forEach((slot) => {
      const rawState = (slot.dataset.rawState || "empty") as CellVisualState;
      const shouldShow =
        rawState === "empty" ||
        rawState === "candidate" ||
        rawState === "invalid" ||
        rawState === "current" ||
        rawState === "removed" ||
        rawState === "restored" ||
        ((rawState === "forced") && visible.forced) ||
        ((rawState === "decision") && visible.decisions) ||
        ((rawState === "rejected" || rawState === "backtracked") && visible.rejected) ||
        ((rawState === "solution") && visible.solution);
      const state = shouldShow ? rawState : "empty";
      if (state === "empty") delete slot.dataset.state;
      else slot.dataset.state = state;
      const input = slot.querySelector<HTMLInputElement>(".board-cell");
      if (input) {
        const auxiliaryDescription =
          slot.dataset.domainChange === "remove"
            ? stateDescriptions.removed
            : slot.dataset.domainChange === "restore"
              ? stateDescriptions.restored
              : slot.dataset.candidate === "true"
                ? stateDescriptions.candidate
                : undefined;
        const descriptions = [...new Set([stateDescriptions[state], auxiliaryDescription].filter(Boolean))];
        if (descriptions.length) input.setAttribute("aria-description", descriptions.join("; "));
        else input.removeAttribute("aria-description");
      }
    });
  }

  function getPuzzleInput(): Puzzle {
    const cells = new Int16Array(currentSize * currentSize);
    inputs().forEach((input, index) => {
      const value = Number(input.value);
      cells[index] = Number.isInteger(value) && value > 0 ? value : 0;
    });
    return { size: currentSize, cells };
  }

  function getSolveOptions(): SolveControlOptions {
    return {
      mode: refs.uniqueness.checked ? "check-unique" : "first",
      maxNodes: Math.trunc(positiveNumber(refs.maxNodes, 2_000_000)),
      maxElapsedMs: Math.round(positiveNumber(refs.maxTime, 10) * 1_000),
      maxTraceEvents: nonNegativeInteger(refs.maxTrace, 20_000),
    };
  }

  function getLayerVisibility(): TraceLayerVisibility {
    return {
      forced: refs.showForced.checked,
      decisions: refs.showDecisions.checked,
      rejected: refs.showRejected.checked,
      solution: refs.showSolutionLayer.checked,
    };
  }

  function setCellValues(values: ArrayLike<number>): void {
    const cells = inputs();
    cells.forEach((input, index) => {
      const value = Number(values[index] ?? 0);
      input.value = Number.isFinite(value) && value > 0 ? String(Math.trunc(value)) : "";
      input.removeAttribute("aria-invalid");
    });
    updateVisiblePath();
  }

  function setGivenCells(
    given: ArrayLike<boolean | number> | ReadonlySet<number>,
  ): void {
    slots().forEach((slot, index) => {
      slot.dataset.given = String(isGivenAt(given, index));
    });
  }

  function setCellStates(states: readonly (CellVisualState | undefined)[]): void {
    slots().forEach((slot, index) => {
      slot.dataset.rawState = states[index] ?? "empty";
    });
    applyStateVisibility();
  }

  function setGridReadOnly(readOnly: boolean): void {
    gridReadOnly = readOnly;
    applyReadOnly();
  }

  function setBoardMode(mode: BoardMode): void {
    currentMode = mode;
    refs.showSolution.setAttribute("aria-pressed", String(mode === "solution"));
    refs.replayTrace.setAttribute("aria-pressed", String(mode === "trace"));
    refs.boardModeLabel.textContent =
      mode === "edit" ? "Editing clues" : mode === "solution" ? "Solved grid" : "Search replay";
    refs.boardInstructions.textContent =
      mode === "edit"
        ? `Type clue values from 1 to ${currentSize * currentSize}. Use the arrow keys to move between cells.`
        : mode === "solution"
          ? "Solved grid. Choose Replay search to step through the search."
          : "Use the replay controls to step through the search.";
    setGridReadOnly(mode !== "edit");
  }

  function renderGrid(puzzle: Puzzle, options: GridRenderOptions = {}): void {
    const size = clampInteger(puzzle.size, MIN_SIZE, MAX_SIZE);
    currentSize = size;
    refs.boardSize.value = String(size);
    refs.boardGrid.style.setProperty("--board-size", String(size));
    refs.boardGrid.setAttribute("aria-rowcount", String(size + 1));
    refs.boardGrid.setAttribute("aria-colcount", String(size + 1));
    refs.boardGrid.replaceChildren();

    const fragment = ownerDocument.createDocumentFragment();
    const headerRow = ownerDocument.createElement("div");
    headerRow.className = "grid-row";
    headerRow.setAttribute("role", "row");
    headerRow.setAttribute("aria-rowindex", "1");
    const corner = ownerDocument.createElement("span");
    corner.className = "grid-corner";
    corner.setAttribute("aria-hidden", "true");
    corner.textContent = "·";
    headerRow.append(corner);
    for (let column = 0; column < size; column += 1) {
      const header = ownerDocument.createElement("span");
      header.className = "grid-column-header";
      header.setAttribute("role", "columnheader");
      header.setAttribute("aria-colindex", String(column + 2));
      header.setAttribute("aria-label", `Column ${column + 1}`);
      header.textContent = String(column + 1);
      headerRow.append(header);
    }
    fragment.append(headerRow);

    const requestedFocus = clampInteger(options.focusIndex ?? 0, 0, size * size - 1);
    for (let row = 0; row < size; row += 1) {
      const rowElement = ownerDocument.createElement("div");
      rowElement.className = "grid-row";
      rowElement.setAttribute("role", "row");
      rowElement.setAttribute("aria-rowindex", String(row + 2));

      const rowHeader = ownerDocument.createElement("span");
      rowHeader.className = "grid-row-header";
      rowHeader.setAttribute("role", "rowheader");
      rowHeader.setAttribute("aria-label", `Row ${row + 1}`);
      rowHeader.textContent = String(row + 1);
      rowElement.append(rowHeader);

      for (let column = 0; column < size; column += 1) {
        const index = row * size + column;
        const slot = ownerDocument.createElement("span");
        slot.className = "cell-slot";
        slot.setAttribute("role", "gridcell");
        slot.setAttribute("aria-colindex", String(column + 2));
        slot.dataset.index = String(index);
        slot.dataset.given = String(isGivenAt(options.given, index));
        slot.dataset.rawState = options.states?.[index] ?? "empty";

        const pathIn = ownerDocument.createElement("span");
        pathIn.className = "path-arm path-arm-in";
        pathIn.setAttribute("aria-hidden", "true");
        const pathOut = ownerDocument.createElement("span");
        pathOut.className = "path-arm path-arm-out";
        pathOut.setAttribute("aria-hidden", "true");

        const input = ownerDocument.createElement("input");
        input.className = "board-cell";
        input.id = `cell-${row + 1}-${column + 1}`;
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.spellcheck = false;
        input.maxLength = String(size * size).length;
        input.pattern = "[0-9]*";
        input.dataset.index = String(index);
        input.dataset.row = String(row);
        input.dataset.column = String(column);
        input.setAttribute("aria-label", `Row ${row + 1}, column ${column + 1}`);
        input.tabIndex = index === requestedFocus ? 0 : -1;
        const value = Number(puzzle.cells[index] ?? 0);
        input.value = value > 0 ? String(value) : "";
        slot.append(pathIn, pathOut, input);
        rowElement.append(slot);
      }
      fragment.append(rowElement);
    }
    refs.boardGrid.append(fragment);
    updateVisiblePath();

    const renderMode = options.mode ?? (options.readOnly ? "solution" : "edit");
    if (renderMode === "solution") {
      solutionForCopy = { size, cells: Int16Array.from(puzzle.cells) };
      solutionGivens = options.given && !(options.given instanceof Set)
        ? Int16Array.from(options.given as ArrayLike<number>)
        : undefined;
    } else if (renderMode === "edit") {
      solutionForCopy = undefined;
      solutionGivens = undefined;
    }
    gridReadOnly = options.readOnly ?? renderMode !== "edit";
    applyReadOnly();
    applyStateVisibility();
    setBoardMode(renderMode);
    if (options.readOnly !== undefined) setGridReadOnly(options.readOnly);
  }

  function setPresets(presets: readonly PresetOption[], selectedId = ""): void {
    presetDescriptions.clear();
    const placeholder = ownerDocument.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose an example…";
    refs.preset.replaceChildren(placeholder);
    presets.forEach((preset) => {
      const option = ownerDocument.createElement("option");
      option.value = preset.id;
      option.textContent = preset.name.includes("×") ? preset.name : `${preset.name} (${preset.size} × ${preset.size})`;
      refs.preset.append(option);
      presetDescriptions.set(preset.id, preset.description ?? "");
    });
    refs.preset.value = presets.some((preset) => preset.id === selectedId) ? selectedId : "";
    refs.loadPreset.disabled = !refs.preset.value;
    refs.presetDescription.textContent = refs.preset.value
      ? presetDescriptions.get(refs.preset.value) || ""
      : "";
  }

  function setPresetDescription(description: string): void {
    refs.presetDescription.textContent = description;
  }

  function setInputError(message = "", invalidCells: readonly number[] = []): void {
    refs.inputError.textContent = message;
    refs.inputError.hidden = !message;
    const invalid = new Set(invalidCells);
    slots().forEach((slot, index) => {
      if (invalid.has(index)) {
        slot.dataset.rawState = "invalid";
        slot.querySelector("input")?.setAttribute("aria-invalid", "true");
      } else if (slot.dataset.rawState === "invalid") {
        slot.dataset.rawState = "empty";
        slot.querySelector("input")?.removeAttribute("aria-invalid");
      }
    });
    applyStateVisibility();
  }

  function setStatus(status: UiSolveStatus, message: string, detail = ""): void {
    refs.resultPanel.dataset.status = status;
    refs.statusBadge.dataset.status = status;
    refs.statusBadge.textContent = statusLabels[status];
    refs.statusMessage.textContent = message;
    refs.statusDetail.textContent = detail;
  }

  function setResult(result: ResultPresentation): void {
    const hasSolution = result.hasSolution ?? (Boolean(result.solution) || result.status === "solved");
    const hasTrace = result.hasTrace ?? Boolean(result.trace?.length);
    let message = result.message;
    let detail = result.detail ?? "";

    if (!message) {
      if (result.status === "solved") {
        if (result.uniqueness === "unique") {
          message = "Solved. This is the only solution.";
        } else if (result.uniqueness === "multiple") {
          message = "Solved, but there is more than one solution.";
        } else if (result.uniqueness === "unknown") {
          message = "Solved. Ran out of time checking for others.";
        } else {
          message = "Solved.";
        }
      } else if (result.status === "invalid") {
        message = "Some clues break the rules. They're marked in red.";
      } else if (result.status === "unsatisfiable") {
        message = "This puzzle has no solution.";
      } else if (result.status === "limit-reached") {
        message = hasSolution
          ? "Solved. Ran out of time checking for others."
          : "Ran out of time. Raise the limits in Search settings.";
      } else {
        message = "Solve cancelled.";
      }
    }

    setStatus(result.status, message, detail);
    if (result.errors?.length) {
      const errorMessages = result.errors.map((error) =>
        typeof error === "string" ? error : error.message,
      );
      const invalidCells = result.errors.flatMap((error) =>
        typeof error === "string" ? [] : [...(error.cells ?? [])],
      );
      setInputError(errorMessages.join(" "), invalidCells);
    } else setInputError();
    if (result.metrics) setMetrics(result.metrics);
    if (hasSolution && result.solution && result.size) {
      renderGrid(
        { size: result.size, cells: Int16Array.from(result.solution) },
        { mode: "solution", given: result.initialCells },
      );
    }
    refs.resultActions.hidden = !hasSolution && !hasTrace;
    refs.showSolution.hidden = !hasSolution;
    refs.copySolution.hidden = !hasSolution;
    refs.replayTrace.disabled = !hasTrace;
    refs.replayTrace.hidden = !hasTrace;
    refs.copySolution.disabled = !hasSolution;
    setTraceAvailable(hasTrace, result.trace?.length ?? traceTotal);
    if (hasSolution) setBoardMode("solution");
  }

  function setBusy(busy: boolean, message?: string): void {
    refs.resultPanel.setAttribute("aria-busy", String(busy));
    refs.boardGrid.setAttribute("aria-busy", String(busy));
    refs.boardSize.disabled = busy;
    refs.preset.disabled = busy;
    refs.loadPreset.disabled = busy || !refs.preset.value;
    refs.pastePuzzle.disabled = busy;
    refs.clearBoard.disabled = busy;
    refs.uniqueness.disabled = busy;
    refs.maxNodes.disabled = busy;
    refs.maxTime.disabled = busy;
    refs.maxTrace.disabled = busy;
    refs.solve.disabled = busy;
    refs.cancel.disabled = !busy;
    inputs().forEach((input) => {
      input.readOnly = busy || gridReadOnly;
      input.setAttribute("aria-readonly", String(busy || gridReadOnly));
    });
    if (busy) setStatus("solving", message ?? "Solving…");
  }

  function setMetrics(metrics: MetricPresentation = {}): void {
    refs.nodesMetric.textContent = formatCount(metrics.expandedNodes ?? metrics.nodes);
    refs.forcedMetric.textContent = formatCount(
      metrics.forcedMoves ?? metrics.forcedPlacements ?? metrics.propagations,
    );
    refs.solutionsMetric.textContent = formatCount(metrics.solutionsFound);
    refs.backtracksMetric.textContent = formatCount(metrics.backtracks);
    refs.depthMetric.textContent = formatCount(metrics.maxDepth);
    refs.elapsedMetric.textContent = formatElapsed(metrics.elapsedMs);
    refs.traceEventsMetric.textContent = formatCount(metrics.traceEvents);
    refs.traceTruncated.hidden = !metrics.traceTruncated;
  }

  function cellLabel(cell: number): string {
    return `r${Math.floor(cell / currentSize) + 1}, c${(cell % currentSize) + 1}`;
  }

  function setAlgorithmPhase(phase: TraceAlgorithmPhase): void {
    refs.algorithmPhase.dataset.phase = phase;
    refs.algorithmPhase.textContent = phaseLabels[phase];
  }

  function setActiveCodeLine(codeLine?: TraceCodeLine): void {
    refs.algorithmCode
      .querySelectorAll<HTMLElement>("[data-code-line]")
      .forEach((line) => {
        if (line.dataset.codeLine === codeLine) {
          line.dataset.active = "true";
          line.setAttribute("aria-current", "step");
        } else {
          delete line.dataset.active;
          line.removeAttribute("aria-current");
        }
      });
    if (codeLine) refs.algorithmCode.dataset.activeLine = codeLine;
    else delete refs.algorithmCode.dataset.activeLine;
  }

  function setDomainCandidates(domain?: DomainPresentation): void {
    slots().forEach((slot) => {
      delete slot.dataset.candidate;
      delete slot.dataset.activeCandidate;
    });
    refs.domainCandidates.replaceChildren();

    if (!domain || domain.value === undefined) {
      refs.domainSummary.textContent = "No value selected";
      refs.domainCandidates.classList.add("empty-structure");
      const empty = ownerDocument.createElement("span");
      empty.textContent = "Candidate cells will appear here.";
      refs.domainCandidates.append(empty);
      applyStateVisibility();
      return;
    }

    const exactCount = Math.max(0, domain.candidateCount);
    refs.domainSummary.textContent = `${domain.value} can go in ${exactCount} ${exactCount === 1 ? "square" : "squares"}`;
    refs.domainCandidates.classList.toggle("empty-structure", exactCount === 0);

    if (exactCount === 0) {
      const empty = ownerDocument.createElement("span");
      empty.textContent = "No cell is left for this value, so this guess fails.";
      refs.domainCandidates.append(empty);
      applyStateVisibility();
      return;
    }

    domain.candidateCells.forEach((cell) => {
      const chip = ownerDocument.createElement("span");
      chip.className = "candidate-chip";
      chip.dataset.cell = String(cell);
      chip.textContent = cellLabel(cell);
      if (cell === domain.activeCell) {
        chip.dataset.active = "true";
        chip.setAttribute("aria-label", `${cellLabel(cell)}, chosen candidate for this branch`);
      }
      refs.domainCandidates.append(chip);
      const slot = refs.boardGrid.querySelector<HTMLElement>(`.cell-slot[data-index="${cell}"]`);
      if (slot) {
        slot.dataset.candidate = "true";
        if (cell === domain.activeCell) slot.dataset.activeCandidate = "true";
      }
    });

    const omitted = Math.max(
      domain.candidatesOmitted ?? 0,
      exactCount - domain.candidateCells.length,
    );
    if (omitted > 0) {
      const overflow = ownerDocument.createElement("span");
      overflow.className = "candidate-overflow";
      overflow.textContent = `+${omitted} more`;
      refs.domainCandidates.append(overflow);
    }
    applyStateVisibility();
  }

  function setPropagationScan(worklist?: TraceWorklistSummary): void {
    const entries: readonly [string, number][] = [
      ["passes", worklist?.passes ?? 0],
      ["value singletons", worklist?.valueSingletonsProcessed ?? 0],
      ["cell singletons", worklist?.cellSingletonsProcessed ?? 0],
      ["adjacency checks", worklist?.adjacencyCandidatesChecked ?? 0],
      ["segments checked", worklist?.connectivitySegmentsChecked ?? 0],
    ];
    refs.propagationScan.replaceChildren();
    refs.propagationScan.classList.toggle("empty-structure", !worklist);
    refs.propagationScan.dataset.strategy = worklist?.strategy ?? "fixpoint-scan";
    entries.forEach(([label, value]) => {
      const row = ownerDocument.createElement("div");
      const term = ownerDocument.createElement("dt");
      const count = ownerDocument.createElement("dd");
      term.textContent = label;
      count.textContent = formatCount(value);
      row.append(term, count);
      refs.propagationScan.append(row);
    });
  }

  function setDecisionStack(stack?: BranchStackPresentation): void {
    refs.decisionStack.replaceChildren();
    if (!stack || stack.depth === 0) {
      refs.decisionStack.classList.add("empty-structure");
      const empty = ownerDocument.createElement("li");
      empty.textContent = "No guesses yet";
      refs.decisionStack.append(empty);
      refs.decisionStack.dataset.depth = "0";
      return;
    }

    refs.decisionStack.classList.remove("empty-structure");
    refs.decisionStack.dataset.depth = String(stack.depth);
    if ((stack.omitted ?? 0) > 0) {
      const omitted = ownerDocument.createElement("li");
      omitted.className = "stack-omitted";
      omitted.textContent = `… ${stack.omitted} earlier ${stack.omitted === 1 ? "branch" : "branches"}`;
      refs.decisionStack.append(omitted);
    }
    stack.frames.forEach((frame) => {
      const item = ownerDocument.createElement("li");
      item.dataset.depth = String(frame.depth);
      item.dataset.value = String(frame.value);
      item.dataset.cell = String(frame.cell);
      item.textContent = `d${frame.depth}: ${frame.value} → ${cellLabel(frame.cell)}, guess ${frame.candidateIndex + 1} of ${frame.candidateCount}`;
      refs.decisionStack.append(item);
    });
  }

  function setDomainDeltas(changes?: DomainDeltaPresentation): void {
    refs.domainDeltas.replaceChildren();
    delete refs.domainDeltas.dataset.operation;
    slots().forEach((slot) => delete slot.dataset.domainChange);
    if (!changes || changes.deltas.length === 0) {
      refs.domainDeltas.dataset.changedCandidates = String(changes?.changedCandidateCount ?? 0);
      applyStateVisibility();
      return;
    }

    refs.domainDeltas.dataset.changedCandidates = String(changes.changedCandidateCount);
    const summary = ownerDocument.createElement("strong");
    const verb = changes.deltas.some((delta) => delta.operation === "restore")
      ? "restored"
      : "removed";
    refs.domainDeltas.dataset.operation = verb === "restored" ? "restore" : "remove";
    summary.textContent = `${formatCount(changes.changedCandidateCount)} ${changes.changedCandidateCount === 1 ? "candidate" : "candidates"} ${verb}`;
    refs.domainDeltas.append(summary);

    changes.deltas.forEach((delta) => {
      const item = ownerDocument.createElement("span");
      const preview = delta.cells.map(cellLabel).join(", ");
      const cellOverflow = delta.cellsOmitted > 0 ? ` +${delta.cellsOmitted}` : "";
      item.textContent = `v${delta.value}: ${delta.beforeSize} → ${delta.afterSize}${preview ? ` (${preview}${cellOverflow})` : ""}`;
      item.dataset.operation = delta.operation;
      refs.domainDeltas.append(item);
      if (delta.value !== changes.activeValue) return;
      delta.cells.forEach((cell) => {
        const slot = refs.boardGrid.querySelector<HTMLElement>(`.cell-slot[data-index="${cell}"]`);
        if (slot) slot.dataset.domainChange = delta.operation;
      });
    });
    if ((changes.omitted ?? 0) > 0) {
      const omitted = ownerDocument.createElement("span");
      omitted.textContent = `+${changes.omitted} changed value ${changes.omitted === 1 ? "domain" : "domains"}`;
      refs.domainDeltas.append(omitted);
    }
    applyStateVisibility();
  }

  function setExplanation(message: string): void {
    refs.algorithmExplanation.textContent = message || "No note for this step.";
  }

  function setExplainerSnapshot(snapshot?: TraceExplainerSnapshot): void {
    if (!snapshot) {
      refs.explanationPanel.setAttribute("aria-live", "polite");
      refs.algorithmPhase.dataset.phase = "ready";
      refs.algorithmPhase.textContent = "Ready";
      setActiveCodeLine();
      setDomainCandidates();
      setPropagationScan();
      setDecisionStack();
      setDomainDeltas();
      setExplanation("");
      return;
    }

    setAlgorithmPhase(snapshot.phase);
    setActiveCodeLine(snapshot.codeLine);
    setDomainCandidates({
      value: snapshot.activeValue,
      activeCell: snapshot.phase === "try-candidate" ? snapshot.activeCell : undefined,
      candidateCount: snapshot.candidateCount,
      candidateCells: snapshot.candidateCells,
      candidatesOmitted: snapshot.candidatesOmitted,
    });
    setPropagationScan(snapshot.worklist);
    setDecisionStack({
      depth: snapshot.branchDepth,
      frames: snapshot.branchStack,
      omitted: snapshot.branchesOmitted,
    });
    setDomainDeltas({
      activeValue: snapshot.activeValue,
      deltas: snapshot.domainDeltas,
      changedCandidateCount: snapshot.changedCandidateCount,
      omitted: snapshot.deltasOmitted,
    });
    setExplanation(snapshot.reasonDetail);
  }

  function setTraceAvailable(available: boolean, total = traceTotal): void {
    traceTotal = available ? Math.max(0, total) : 0;
    const hasFrames = available && traceTotal > 0;
    const currentIndex = clampInteger(Number(refs.traceScrubber.value), 0, Math.max(0, traceTotal - 1));
    refs.traceFirst.disabled = !hasFrames || currentIndex === 0;
    refs.tracePrevious.disabled = !hasFrames || currentIndex === 0;
    refs.tracePlay.disabled = !hasFrames || traceTotal <= 1;
    refs.tracePause.disabled = !hasFrames || traceTotal <= 1;
    refs.traceNext.disabled = !hasFrames || currentIndex >= traceTotal - 1;
    refs.traceLast.disabled = !hasFrames || currentIndex >= traceTotal - 1;
    refs.traceScrubber.disabled = !hasFrames;
    refs.replayTrace.disabled = !hasFrames;
    refs.traceScrubber.max = String(Math.max(0, traceTotal - 1));
    if (!hasFrames) {
      refs.traceScrubber.value = "0";
      refs.traceCounter.value = "0 of 0";
      refs.traceKindBadge.dataset.kind = "none";
      refs.traceKindBadge.textContent = eventLabels.none;
      setExplainerSnapshot();
    }
  }

  function setTraceState(trace: TracePresentation): void {
    traceTotal = Math.max(0, trace.total);
    const lastIndex = Math.max(0, traceTotal - 1);
    const index = clampInteger(trace.index, 0, lastIndex);
    const kind = trace.kind ?? "none";
    refs.explanationPanel.setAttribute("aria-live", trace.playing ? "off" : "polite");
    setTraceAvailable(traceTotal > 0, traceTotal);
    refs.traceScrubber.value = String(index);
    refs.traceCounter.value = traceTotal > 0 ? `${index + 1} of ${traceTotal}` : "0 of 0";
    refs.traceKindBadge.dataset.kind = kind;
    refs.traceKindBadge.textContent = eventLabels[kind];
    refs.traceDetail.textContent =
      trace.detail ??
      (traceTotal
        ? [
            `Frame ${index + 1}`,
            trace.depth === undefined ? "" : `depth ${trace.depth}`,
            trace.value === undefined ? "" : `value ${trace.value}`,
            trace.cell === undefined
              ? ""
              : `row ${Math.floor(trace.cell / currentSize) + 1}, column ${(trace.cell % currentSize) + 1}`,
          ]
            .filter(Boolean)
            .join(", ")
        : "");
    refs.traceTruncated.hidden = !trace.truncated;

    const phase = fallbackPhase[kind];
    if (phase) setAlgorithmPhase(phase);
    setActiveCodeLine(fallbackCodeLine[kind]);
    if (trace.detail) setExplanation(trace.detail);

    const atStart = index <= 0;
    const atEnd = index >= lastIndex;
    refs.traceFirst.disabled = traceTotal === 0 || atStart;
    refs.tracePrevious.disabled = traceTotal === 0 || atStart;
    refs.traceNext.disabled = traceTotal === 0 || atEnd;
    refs.traceLast.disabled = traceTotal === 0 || atEnd;
    refs.tracePlay.hidden = Boolean(trace.playing);
    refs.tracePause.hidden = !trace.playing;
    refs.tracePlay.disabled = traceTotal <= 1;
    refs.tracePause.disabled = traceTotal <= 1;
  }

  function showToast(message: string): void {
    refs.toastRegion.textContent = message;
    refs.toastRegion.classList.add("is-visible");
    if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      refs.toastRegion.classList.remove("is-visible");
      toastTimer = undefined;
    }, 2_400);
  }

  function openPasteDialog(): void {
    refs.pasteError.textContent = "";
    if (typeof refs.pasteDialog.showModal === "function") refs.pasteDialog.showModal();
    else refs.pasteDialog.setAttribute("open", "");
    window.setTimeout(() => refs.pasteText.focus(), 0);
  }

  function closePasteDialog(): void {
    if (refs.pasteDialog.open && typeof refs.pasteDialog.close === "function") refs.pasteDialog.close();
    else refs.pasteDialog.removeAttribute("open");
  }

  function applyPastedText(text: string): boolean {
    const parsed = parsePastedGrid(text);
    if (!parsed.ok) {
      refs.pasteError.textContent = parsed.error;
      return false;
    }
    const previousSize = currentSize;
    renderGrid(parsed.puzzle, {
      mode: "edit",
      given: parsed.puzzle.cells,
    });
    if (previousSize !== parsed.puzzle.size) emit("sizeChange", parsed.puzzle.size);
    emit("paste", parsed.puzzle);
    emit("puzzleChange", parsed.puzzle);
    setInputError();
    closePasteDialog();
    showToast(`${parsed.puzzle.size} × ${parsed.puzzle.size} puzzle pasted.`);
    return true;
  }

  refs.boardGrid.addEventListener(
    "focusin",
    (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : undefined;
      if (!input?.classList.contains("board-cell")) return;
      setRovingIndex(Number(input.dataset.index));
    },
    { signal },
  );

  refs.boardGrid.addEventListener(
    "keydown",
    (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : undefined;
      if (!input?.classList.contains("board-cell")) return;
      const index = Number(input.dataset.index);
      const row = Math.floor(index / currentSize);
      const column = index % currentSize;
      let target: number | undefined;
      if (event.key === "ArrowLeft") target = column > 0 ? index - 1 : index;
      else if (event.key === "ArrowRight") target = column < currentSize - 1 ? index + 1 : index;
      else if (event.key === "ArrowUp") target = row > 0 ? index - currentSize : index;
      else if (event.key === "ArrowDown") target = row < currentSize - 1 ? index + currentSize : index;
      else if (event.key === "Home") target = event.ctrlKey ? 0 : row * currentSize;
      else if (event.key === "End") {
        target = event.ctrlKey ? currentSize * currentSize - 1 : row * currentSize + currentSize - 1;
      } else if ((event.key === "Delete" || event.key === "Backspace") && !input.readOnly) {
        if (input.value) {
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        return;
      } else if (event.key === "Enter") {
        target = Math.min(currentSize * currentSize - 1, index + 1);
      }
      if (target !== undefined) {
        event.preventDefault();
        setRovingIndex(target, true);
      }
    },
    { signal },
  );

  refs.boardGrid.addEventListener(
    "input",
    (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : undefined;
      if (!input?.classList.contains("board-cell") || input.readOnly) return;
      const cleaned = input.value.replace(/\D/g, "").slice(0, String(currentSize * currentSize).length);
      if (input.value !== cleaned) input.value = cleaned;
      const value = Number(cleaned);
      const invalid = cleaned !== "" && (!Number.isInteger(value) || value < 1 || value > currentSize * currentSize);
      const slot = input.closest<HTMLElement>(".cell-slot");
      if (slot) {
        slot.dataset.given = String(cleaned !== "");
        if (invalid) slot.dataset.rawState = "invalid";
        else if (slot.dataset.rawState === "invalid") slot.dataset.rawState = "empty";
      }
      input.setAttribute("aria-invalid", String(invalid));
      applyStateVisibility();
      updateVisiblePath();
      emit("puzzleChange", getPuzzleInput());
    },
    { signal },
  );

  refs.boardGrid.addEventListener(
    "paste",
    (event) => {
      const input = event.target instanceof HTMLInputElement ? event.target : undefined;
      if (!input?.classList.contains("board-cell") || input.readOnly) return;
      const text = event.clipboardData?.getData("text") ?? "";
      if (!/[\n,;|\t ]/.test(text.trim())) return;
      event.preventDefault();
      const parsed = parsePastedGrid(text, currentSize);
      if (!parsed.ok) {
        setInputError(parsed.error);
        return;
      }
      renderGrid(parsed.puzzle, { mode: "edit", given: parsed.puzzle.cells });
      emit("paste", parsed.puzzle);
      emit("puzzleChange", parsed.puzzle);
      setInputError();
    },
    { signal },
  );

  refs.boardSize.addEventListener(
    "change",
    () => {
      const size = clampInteger(Number(refs.boardSize.value), MIN_SIZE, MAX_SIZE);
      solutionForCopy = undefined;
      solutionGivens = undefined;
      const puzzle = { size, cells: new Int16Array(size * size) };
      renderGrid(puzzle, { mode: "edit" });
      setInputError();
      refs.resultActions.hidden = true;
      setStatus("idle", "Type some clues, or pick an example.");
      emit("sizeChange", size);
      emit("puzzleChange", puzzle);
    },
    { signal },
  );

  refs.preset.addEventListener(
    "change",
    () => {
      refs.loadPreset.disabled = !refs.preset.value;
      refs.presetDescription.textContent = refs.preset.value
        ? presetDescriptions.get(refs.preset.value) || ""
        : "";
    },
    { signal },
  );

  refs.loadPreset.addEventListener(
    "click",
    () => {
      if (refs.preset.value) emit("presetLoad", refs.preset.value);
    },
    { signal },
  );

  refs.clearBoard.addEventListener(
    "click",
    () => {
      const puzzle = { size: currentSize, cells: new Int16Array(currentSize * currentSize) };
      solutionForCopy = undefined;
      solutionGivens = undefined;
      renderGrid(puzzle, { mode: "edit" });
      setInputError();
      refs.resultActions.hidden = true;
      setTraceAvailable(false);
      setMetrics();
      setStatus("idle", "Cleared.");
      emit("clear", undefined);
      emit("puzzleChange", puzzle);
    },
    { signal },
  );

  refs.solve.addEventListener(
    "click",
    () => emit("solve", { puzzle: getPuzzleInput(), options: getSolveOptions() }),
    { signal },
  );
  refs.cancel.addEventListener("click", () => emit("cancel", undefined), { signal });

  refs.showSolution.addEventListener(
    "click",
    () => {
      if (solutionForCopy) {
        renderGrid(solutionForCopy, { mode: "solution", given: solutionGivens });
      } else {
        setBoardMode("solution");
      }
      emit("modeChange", "solution");
    },
    { signal },
  );
  refs.replayTrace.addEventListener(
    "click",
    () => {
      setBoardMode("trace");
      emit("modeChange", "trace");
    },
    { signal },
  );

  refs.copySolution.addEventListener(
    "click",
    async () => {
      const text = formatPuzzleGrid(solutionForCopy ?? getPuzzleInput());
      try {
        await navigator.clipboard.writeText(text);
        showToast("Grid copied to the clipboard.");
      } catch {
        const textarea = ownerDocument.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        ownerDocument.body.append(textarea);
        textarea.select();
        const copied = ownerDocument.execCommand("copy");
        textarea.remove();
        showToast(copied ? "Grid copied to the clipboard." : "Could not copy the grid.");
      }
      emit("copy", undefined);
    },
    { signal },
  );

  refs.pastePuzzle.addEventListener("click", openPasteDialog, { signal });
  refs.closePaste.addEventListener("click", closePasteDialog, { signal });
  refs.cancelPaste.addEventListener("click", closePasteDialog, { signal });
  refs.pasteForm.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      applyPastedText(refs.pasteText.value);
    },
    { signal },
  );

  refs.traceFirst.addEventListener("click", () => emit("traceSeek", 0), { signal });
  refs.tracePrevious.addEventListener("click", () => emit("traceStep", -1), { signal });
  refs.traceNext.addEventListener("click", () => emit("traceStep", 1), { signal });
  refs.traceLast.addEventListener(
    "click",
    () => emit("traceSeek", Math.max(0, traceTotal - 1)),
    { signal },
  );
  refs.tracePlay.addEventListener("click", () => emit("tracePlay", undefined), { signal });
  refs.tracePause.addEventListener("click", () => emit("tracePause", undefined), { signal });
  refs.traceScrubber.addEventListener(
    "input",
    () => emit("traceSeek", Number(refs.traceScrubber.value)),
    { signal },
  );
  refs.traceSpeed.addEventListener(
    "input",
    () => {
      const speed = clampInteger(Number(refs.traceSpeed.value), 1, 30);
      refs.traceSpeedValue.value = `${speed} frame${speed === 1 ? "" : "s"}/sec`;
      emit("speedChange", speed);
    },
    { signal },
  );

  const layerControls = [
    refs.showForced,
    refs.showDecisions,
    refs.showRejected,
    refs.showSolutionLayer,
  ];
  layerControls.forEach((control) => {
    control.addEventListener(
      "change",
      () => {
        applyStateVisibility();
        emit("layersChange", getLayerVisibility());
      },
      { signal },
    );
  });

  const initialPuzzle: Puzzle = {
    size: currentSize,
    cells: new Int16Array(currentSize * currentSize),
  };
  renderGrid(initialPuzzle, { mode: "edit" });
  setTraceAvailable(false);
  setMetrics();

  return {
    refs,
    on(handlers) {
      subscribers.add(handlers);
      return () => subscribers.delete(handlers);
    },
    destroy() {
      abortController.abort();
      subscribers.clear();
      if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    },
    getPuzzleInput,
    getSolveOptions,
    getLayerVisibility,
    setPresets,
    setPresetDescription,
    renderGrid,
    setCellValues,
    setCellStates,
    setGivenCells,
    setGridReadOnly,
    setBoardMode,
    setBusy,
    setStatus,
    setResult,
    setInputError,
    setMetrics,
    setTraceState,
    setTraceAvailable,
    setAlgorithmPhase,
    setActiveCodeLine,
    setDomainCandidates,
    setPropagationScan,
    setDecisionStack,
    setDomainDeltas,
    setExplanation,
    setExplainerSnapshot,
    showToast,
  };
}
