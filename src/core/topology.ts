export interface Topology {
  size: number;
  total: number;
  rowOf: Int16Array;
  colOf: Int16Array;
  neighbors: readonly Int16Array[];
}

const cache = new Map<number, Topology>();

export function getTopology(size: number): Topology {
  const cached = cache.get(size);
  if (cached) {
    return cached;
  }

  const total = size * size;
  const rowOf = new Int16Array(total);
  const colOf = new Int16Array(total);
  const neighbors: Int16Array[] = [];

  for (let cell = 0; cell < total; cell += 1) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    rowOf[cell] = row;
    colOf[cell] = col;
    const adjacent: number[] = [];
    if (row > 0) adjacent.push(cell - size);
    if (row + 1 < size) adjacent.push(cell + size);
    if (col > 0) adjacent.push(cell - 1);
    if (col + 1 < size) adjacent.push(cell + 1);
    neighbors.push(Int16Array.from(adjacent));
  }

  const topology: Topology = { size, total, rowOf, colOf, neighbors };
  cache.set(size, topology);
  return topology;
}

export function manhattan(topology: Topology, left: number, right: number): number {
  return (
    Math.abs(topology.rowOf[left]! - topology.rowOf[right]!) +
    Math.abs(topology.colOf[left]! - topology.colOf[right]!)
  );
}

export function areNeighbors(topology: Topology, left: number, right: number): boolean {
  return manhattan(topology, left, right) === 1;
}
