# Numbrix search debugger

A browser-based Numbrix editor with an interactive constraint-search replay. It
supports square boards from 3×3 through 15×15 and runs the solver in a web
worker so the editor stays responsive.

## Run locally

```sh
npm install
npm run dev
```

Open the URL printed by Vite.

## Using the debugger

Choose an example, enter clues directly, or paste a whitespace- or
comma-separated grid. Empty cells may be written as `0` or `.`. The arrow keys
move between cells.

Select **Solve & record** to find a completion and record the search. The
transport steps through the board changes; the optional panels show candidate
domains, the active pseudocode line, propagation counters, and the decision
stack. **Solution** returns to the completed board, and **Copy grid** copies it
as rows of numbers.

Search settings control uniqueness checking, the node and time limits, and how
many events are retained for playback. A recording may stop growing while the
solver continues; the status strip reports that case.

## Solver

The solver combines constraint propagation with depth-first search. It uses
clue uniqueness, distance and parity bounds, consecutive-value adjacency,
singleton propagation, and minimum-domain branching. Branch changes are kept
on a reversible trail so they can be shown during replay.

Result states distinguish invalid input, no solution, a reached search limit,
a solution, and cancellation. When uniqueness checking is enabled, the result
also distinguishes one completion from multiple completions.
