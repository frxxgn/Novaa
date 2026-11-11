import { describe, expect, it } from "vitest";
import { bestMoves, emptyBoard, isFull, novaMove, winnerOf, type Board } from "../../src/shared/tictactoe.js";
import { buildState, isWithinDeadline, pickQuestions, publicQuestion, type QuestionRow } from "../../server/games/quiz.js";

function play(mistakeRate: number, playerStrategy: (b: Board) => number, rand: () => number) {
  const board = emptyBoard();
  for (;;) {
    board[playerStrategy(board)] = "X";
    if (winnerOf(board).winner || isFull(board)) break;
    board[novaMove(board, "O", mistakeRate, rand)] = "O";
    if (winnerOf(board).winner || isFull(board)) break;
  }
  return winnerOf(board).winner;
}

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe("tres en raya", () => {
  it("detecta ganador y línea", () => {
    expect(winnerOf(["X", "X", "X", null, null, null, null, null, null])).toEqual({ winner: "X", line: [0, 1, 2] });
    expect(winnerOf(emptyBoard()).winner).toBeNull();
  });

  it("bloquea una victoria inmediata del rival", () => {
    const b: Board = ["X", "X", null, null, "O", null, null, null, null];
    expect(bestMoves(b, "O")).toEqual([2]);
  });

  it("sin errores, Nova nunca pierde (minimax real)", () => {
    for (let s = 1; s <= 60; s++) {
      const rand = seeded(s);
      const winner = play(0, (b) => {
        const free = b.flatMap((c, i) => (c === null ? [i] : []));
        return free[Math.floor(rand() * free.length)]!;
      }, rand);
      expect(winner).not.toBe("X");
    }
  });

  it("con tasa de error, un jugador óptimo puede ganar (niveles con recompensa son superables)", () => {
    let wins = 0;
    for (let s = 1; s <= 200; s++) {
      const rand = seeded(s * 7);
      const winner = play(0.3, (b) => bestMoves(b, "X")[0]!, rand);
      if (winner === "X") wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});

const Q = (id: number, difficulty: number, category: string): QuestionRow => ({ id: `q${id}`, category, difficulty, question: `¿Pregunta ${id}?`, options: ["a", "b", "c", "d"], correct_index: id % 4, explanation: "" });
const POOL: QuestionRow[] = Array.from({ length: 42 }, (_, i) => Q(i, (i % 3) + 1, ["tecnologia", "cultura", "logica", "ciencia", "internet", "curiosidades", "creatividad"][i % 7]!));

describe("quiz", () => {
  it("elige 10 preguntas sin repetir, con mezcla de dificultad y orden progresivo", () => {
    const picked = pickQuestions(POOL, new Set(), 10, { "1": 4, "2": 4, "3": 2 });
    expect(new Set(picked.map((q) => q.id)).size).toBe(10);
    expect(picked.filter((q) => q.difficulty === 1)).toHaveLength(4);
    expect(picked.filter((q) => q.difficulty === 3)).toHaveLength(2);
    const diffs = picked.map((q) => q.difficulty);
    expect([...diffs].sort()).toEqual(diffs);
    expect(new Set(picked.map((q) => q.category)).size).toBeGreaterThanOrEqual(5);
  });

  it("evita preguntas recientes cuando hay alternativas", () => {
    const recent = new Set(POOL.slice(0, 20).map((q) => q.id));
    const picked = pickQuestions(POOL, recent, 10, { "1": 4, "2": 4, "3": 2 });
    expect(picked.some((q) => recent.has(q.id))).toBe(false);
  });

  it("baraja opciones y conserva la respuesta correcta solo en el estado del servidor", () => {
    const q = POOL[5]!;
    const state = buildState([q], new Date());
    const pub = publicQuestion(q, state.questions[0]!, 0, 1);
    expect(pub).not.toHaveProperty("correct_index");
    expect(pub.options[state.questions[0]!.correct]).toBe(q.options[q.correct_index]);
  });

  it("aplica el plazo del servidor con margen", () => {
    const deadline = new Date("2026-01-01T00:01:00Z");
    expect(isWithinDeadline(new Date("2026-01-01T00:01:01Z"), deadline, 1500)).toBe(true);
    expect(isWithinDeadline(new Date("2026-01-01T00:01:02Z"), deadline, 1500)).toBe(false);
  });
});
