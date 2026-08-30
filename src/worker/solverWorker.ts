/// <reference lib="webworker" />

import { solvePuzzle } from "../core";
import type { SolverWorkerInbound, SolverWorkerOutbound } from "./messages";

const workerContext = self as DedicatedWorkerGlobalScope;

workerContext.onmessage = (event: MessageEvent<SolverWorkerInbound>) => {
  const message = event.data;
  if (message.type !== "solve") {
    return;
  }

  try {
    const result = solvePuzzle(message.puzzle, {
      ...message.options,
      onProgress(metrics, trace) {
        const progress: SolverWorkerOutbound = {
          type: "progress",
          requestId: message.requestId,
          metrics,
          trace,
        };
        workerContext.postMessage(progress);
      },
    });
    const response: SolverWorkerOutbound = {
      type: "result",
      requestId: message.requestId,
      result,
    };
    workerContext.postMessage(response);
  } catch (error) {
    const response: SolverWorkerOutbound = {
      type: "failure",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "The solver failed unexpectedly.",
    };
    workerContext.postMessage(response);
  }
};

export {};
