// Lógica pura del tres en raya (compartida). El servidor es la autoridad:
// valida cada jugada y decide la de Nova con minimax.

export type Cell = "X" | "O" | null;
export type Board = Cell[];

export const LINES: [number, number, number][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function emptyBoard(): Board {
  return Array.from({ length: 9 }, () => null);
}

export function winnerOf(board: Board): { winner: "X" | "O" | null; line: number[] | null } {
  for (const [a, b, c] of LINES) {
    const v = board[a];
    if (v && v === board[b] && v === board[c]) return { winner: v, line: [a, b, c] };
  }
  return { winner: null, line: null };
}

export function isFull(board: Board): boolean {
  return board.every((c) => c !== null);
}

export function freeCells(board: Board): number[] {
  return board.flatMap((c, i) => (c === null ? [i] : []));
}

const memo = new Map<string, number>();

/**
 * Valor minimax de la posición desde el punto de vista de `me`
 * (+10 victoria, -10 derrota, 0 tablas). Las victorias más rápidas valen más.
 * Se memoriza por posición: el árbol completo se recorre una sola vez.
 */
function minimax(board: Board, turn: "X" | "O", me: "X" | "O"): number {
  const key = `${board.map((c) => c ?? "-").join("")}${turn}${me}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const { winner } = winnerOf(board);
  let value: number;
  if (winner) value = winner === me ? 10 : -10;
  else if (isFull(board)) value = 0;
  else {
    const scores: number[] = [];
    for (const i of freeCells(board)) {
      board[i] = turn;
      scores.push(decay(minimax(board, turn === "X" ? "O" : "X", me)));
      board[i] = null;
    }
    value = turn === me ? Math.max(...scores) : Math.min(...scores);
  }
  memo.set(key, value);
  return value;
}

const decay = (v: number) => (v > 0 ? v - 1 : v < 0 ? v + 1 : 0);

/** Jugadas óptimas para `me` (todas las que empatan en la mejor puntuación). */
export function bestMoves(board: Board, me: "X" | "O"): number[] {
  const copy = [...board];
  let best = -Infinity;
  let moves: number[] = [];
  for (const i of freeCells(copy)) {
    copy[i] = me;
    const score = decay(minimax(copy, me === "X" ? "O" : "X", me));
    copy[i] = null;
    if (score > best) {
      best = score;
      moves = [i];
    } else if (score === best) {
      moves.push(i);
    }
  }
  return moves;
}

/**
 * Jugada de Nova según dificultad: con probabilidad `mistakeRate` elige una
 * jugada no óptima (si existe), lo que hace que pueda ser derrotada.
 */
export function novaMove(board: Board, me: "X" | "O", mistakeRate: number, rand: () => number = Math.random): number {
  const free = freeCells(board);
  if (free.length === 0) return -1;
  const optimal = bestMoves(board, me);
  const suboptimal = free.filter((i) => !optimal.includes(i));
  if (suboptimal.length > 0 && rand() < mistakeRate) {
    return suboptimal[Math.floor(rand() * suboptimal.length)]!;
  }
  return optimal[Math.floor(rand() * optimal.length)]!;
}
