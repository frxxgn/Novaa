// Selección y validación del quiz. Todo el estado sensible (respuestas
// correctas, orden de opciones, tiempos) vive en el servidor.
import { randomInt } from "node:crypto";

export interface QuestionRow {
  id: string;
  category: string;
  difficulty: number;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface QuizQuestionState {
  id: string;
  order: number[]; // permutación: posición mostrada -> índice original
  correct: number; // índice correcto en el orden mostrado
}

export interface QuizState {
  questions: QuizQuestionState[];
  current: number;
  served_at: string[];
  correct_count: number;
  fast_answers: number;
}

export function shuffle<T>(items: T[], rand: (n: number) => number = randomInt): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/**
 * Elige `total` preguntas con mezcla de dificultad, variedad de categorías y
 * evitando las vistas recientemente cuando hay alternativas.
 */
export function pickQuestions(pool: QuestionRow[], recent: Set<string>, total: number, mix: Record<string, number>, rand: (n: number) => number = randomInt): QuestionRow[] {
  const fresh = pool.filter((q) => !recent.has(q.id));
  const source = fresh.length >= total ? fresh : pool;
  const chosen: QuestionRow[] = [];
  const usedCategories = new Map<string, number>();

  const take = (candidates: QuestionRow[], n: number) => {
    const shuffled = shuffle(candidates, rand);
    // Prioriza categorías menos usadas
    shuffled.sort((a, b) => (usedCategories.get(a.category) ?? 0) - (usedCategories.get(b.category) ?? 0));
    for (const q of shuffled) {
      if (n <= 0) break;
      if (chosen.some((c) => c.id === q.id)) continue;
      chosen.push(q);
      usedCategories.set(q.category, (usedCategories.get(q.category) ?? 0) + 1);
      n--;
    }
  };

  for (const level of ["1", "2", "3"]) {
    const n = Math.max(0, Number(mix[level] ?? 0));
    take(source.filter((q) => String(q.difficulty) === level), n);
  }
  if (chosen.length < total) take(source, total - chosen.length);
  if (chosen.length < total) take(pool, total - chosen.length);

  // Dificultad progresiva: de fácil a difícil
  return chosen.slice(0, total).sort((a, b) => a.difficulty - b.difficulty);
}

export function buildState(questions: QuestionRow[], now: Date, rand: (n: number) => number = randomInt): QuizState {
  return {
    questions: questions.map((q) => {
      const order = shuffle(q.options.map((_, i) => i), rand);
      return { id: q.id, order, correct: order.indexOf(q.correct_index) };
    }),
    current: 0,
    served_at: [now.toISOString()],
    correct_count: 0,
    fast_answers: 0,
  };
}

export function publicQuestion(q: QuestionRow, s: QuizQuestionState, position: number, total: number) {
  return {
    position,
    total,
    category: q.category,
    difficulty: q.difficulty,
    question: q.question,
    options: s.order.map((i) => q.options[i]!),
  };
}

export function isWithinDeadline(now: Date, deadline: Date, graceMs: number): boolean {
  return now.getTime() <= deadline.getTime() + graceMs;
}
