import type { Puzzle, SolveResult, SolverMetrics, TraceEvent } from "../core";
import type {
  SolverWorkerInbound,
  SolverWorkerOutbound,
  WorkerSolveOptions,
} from "./messages";

export interface SolverClientHandlers {
  onProgress?: (metrics: SolverMetrics, trace: TraceEvent[]) => void;
  onResult: (result: SolveResult) => void;
  onError: (message: string) => void;
}

export class SolverClient {
  private worker: Worker | null = null;
  private nextRequestId = 1;
  private activeRequestId: number | null = null;
  private activeHandlers: SolverClientHandlers | null = null;

  solve(puzzle: Puzzle, options: WorkerSolveOptions, handlers: SolverClientHandlers): number {
    this.cancel();
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    this.activeRequestId = requestId;
    this.activeHandlers = handlers;
    this.worker = this.createWorker();

    const message: SolverWorkerInbound = {
      type: "solve",
      requestId,
      puzzle,
      options,
    };
    this.worker.postMessage(message);
    return requestId;
  }

  cancel(): boolean {
    if (!this.worker) {
      return false;
    }
    this.worker.terminate();
    this.worker = null;
    this.activeRequestId = null;
    this.activeHandlers = null;
    return true;
  }

  dispose(): void {
    this.cancel();
  }

  private createWorker(): Worker {
    const worker = new Worker(new URL("./solverWorker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<SolverWorkerOutbound>) => {
      const message = event.data;
      if (message.requestId !== this.activeRequestId || !this.activeHandlers) {
        return;
      }
      if (message.type === "progress") {
        this.activeHandlers.onProgress?.(message.metrics, message.trace);
        return;
      }

      const handlers = this.activeHandlers;
      this.worker?.terminate();
      this.worker = null;
      this.activeRequestId = null;
      this.activeHandlers = null;

      if (message.type === "result") {
        handlers.onResult(message.result);
      } else {
        handlers.onError(message.message);
      }
    };
    worker.onerror = (event: ErrorEvent) => {
      if (!this.activeHandlers) {
        return;
      }
      const handlers = this.activeHandlers;
      this.worker?.terminate();
      this.worker = null;
      this.activeRequestId = null;
      this.activeHandlers = null;
      handlers.onError(event.message || "The solver worker stopped unexpectedly.");
    };
    return worker;
  }
}
