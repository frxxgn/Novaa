import { Hono } from "hono";
import { z } from "zod";
import { emptyBoard, isFull, novaMove, winnerOf, type Board } from "../../src/shared/tictactoe.js";
import { ApiError, forbidden, ipHash, notFound, readJson, tooMany } from "../lib/http.js";
import { admin, getSetting, rateLimit, requireAuth } from "../lib/supabase.js";
import { issueChallengeCoupon, type IssuedCoupon } from "../games/coupons.js";
import { buildState, isWithinDeadline, pickQuestions, publicQuestion, type QuestionRow, type QuizState } from "../games/quiz.js";
import { CHALLENGE_DEFAULTS } from "../games/settings.js";

export const games = new Hono();

const SECURITY_DEFAULTS = { games_per_minute: 60 };

async function guard(c: Parameters<typeof requireAuth>[0]) {
  const auth = await requireAuth(c, { verified: true });
  const cfg = await getSetting("challenge", CHALLENGE_DEFAULTS);
  if (!cfg.enabled) throw new ApiError(503, "challenge_disabled", "Novalius Challenge no está disponible ahora mismo.");
  const security = await getSetting("security", SECURITY_DEFAULTS);
  if (!(await rateLimit(`games:${auth.user.id}`, Number(security.games_per_minute) || 60, 60))) throw tooMany();
  return { auth, cfg };
}

async function attemptsToday(userId: string, game: string): Promise<number> {
  const { data: dayStart } = await admin().rpc("business_day_start");
  const { count } = await admin()
    .from("game_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("game", game)
    .gte("created_at", dayStart as string);
  return count ?? 0;
}

async function closeActive(userId: string, game: string) {
  await admin().from("game_sessions").update({ status: "abandoned", finished_at: new Date().toISOString() }).eq("user_id", userId).eq("game", game).eq("status", "active");
}

async function couponStatus(userId: string) {
  const { data } = await admin().from("coupons").select("code, percent, expires_at, status").eq("user_id", userId).eq("source", "challenge").maybeSingle();
  return data;
}

games.get("/status", async (c) => {
  const auth = await requireAuth(c);
  const cfg = await getSetting("challenge", CHALLENGE_DEFAULTS);
  const [quizToday, tttToday, coupon] = await Promise.all([attemptsToday(auth.user.id, "quiz"), attemptsToday(auth.user.id, "tictactoe"), couponStatus(auth.user.id)]);
  return c.json({
    enabled: cfg.enabled,
    verified: Boolean(auth.user.email_confirmed_at),
    quiz: { questions: cfg.quiz_questions, duration_seconds: cfg.quiz_duration_seconds, attempts_left: Math.max(0, cfg.quiz_attempts_per_day - quizToday) },
    tictactoe: {
      attempts_left: Math.max(0, cfg.ttt_attempts_per_day - tttToday),
      levels: Object.entries(cfg.ttt_levels).map(([key, v]) => ({ key, label: v.label, rewarded: cfg.ttt_reward_levels.includes(key) })),
    },
    coupon_percent: cfg.coupon_percent,
    coupon,
  });
});

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------
games.post("/quiz/start", async (c) => {
  const { auth, cfg } = await guard(c);
  const userId = auth.user.id;
  if ((await attemptsToday(userId, "quiz")) >= cfg.quiz_attempts_per_day) {
    throw new ApiError(429, "attempts_exhausted", "Has agotado los intentos de hoy. Vuelve mañana.");
  }
  await closeActive(userId, "quiz");

  const db = admin();
  const [{ data: pool }, { data: recentSessions }] = await Promise.all([
    db.from("game_questions").select("id, category, difficulty, question, options, correct_index, explanation").eq("is_active", true),
    db.from("game_sessions").select("state").eq("user_id", userId).eq("game", "quiz").order("created_at", { ascending: false }).limit(3),
  ]);
  const questions = (pool ?? []) as QuestionRow[];
  const total = Math.max(1, Number(cfg.quiz_questions) || 10);
  if (questions.length < total) throw new ApiError(503, "not_enough_questions", "No hay suficientes preguntas activas. Avisa al equipo.");

  const recent = new Set<string>();
  for (const s of recentSessions ?? []) for (const q of ((s.state as QuizState)?.questions ?? [])) recent.add(q.id);

  const chosen = pickQuestions(questions, recent, total, cfg.quiz_mix);
  const now = new Date();
  const deadline = new Date(now.getTime() + (Number(cfg.quiz_duration_seconds) || 60) * 1000);
  const state = buildState(chosen, now);

  const { data: session, error } = await db
    .from("game_sessions")
    .insert({ user_id: userId, game: "quiz", status: "active", difficulty: "mixto", state, started_at: now.toISOString(), deadline_at: deadline.toISOString(), ip_hash: ipHash(c) })
    .select("id")
    .single();
  if (error || !session) throw error ?? new Error("No se pudo iniciar la partida");

  return c.json({
    session_id: session.id,
    server_now: now.toISOString(),
    started_at: now.toISOString(),
    deadline_at: deadline.toISOString(),
    duration_seconds: cfg.quiz_duration_seconds,
    question: publicQuestion(chosen[0]!, state.questions[0]!, 0, total),
  });
});

const answerSchema = z.object({ session_id: z.uuid(), position: z.number().int().min(0).max(99), choice: z.number().int().min(0).max(9) });

async function finishQuiz(sessionId: string, userId: string, state: QuizState, startedAt: Date, deadline: Date, now: Date, graceMs: number, flagged: boolean, flagReason: string) {
  const total = state.questions.length;
  const inTime = isWithinDeadline(now, deadline, graceMs);
  const won = state.correct_count === total && inTime && !flagged;
  const status = won ? "won" : inTime ? "lost" : "expired";
  const durationMs = Math.min(now.getTime(), deadline.getTime() + graceMs) - startedAt.getTime();
  await admin()
    .from("game_sessions")
    .update({ status, score: state.correct_count, finished_at: now.toISOString(), duration_ms: durationMs, state, flagged, flag_reason: flagReason })
    .eq("id", sessionId);
  let coupon: IssuedCoupon | null = null;
  if (won) coupon = await issueChallengeCoupon(userId, sessionId, "quiz");
  return { status, score: state.correct_count, total, duration_ms: durationMs, in_time: inTime, flagged, coupon };
}

games.post("/quiz/answer", async (c) => {
  const { auth, cfg } = await guard(c);
  const body = await readJson(c, answerSchema);
  const db = admin();
  const { data: session } = await db.from("game_sessions").select("id, user_id, status, state, started_at, deadline_at, flagged, flag_reason").eq("id", body.session_id).eq("game", "quiz").maybeSingle();
  if (!session) throw notFound("Partida no encontrada.");
  if (session.user_id !== auth.user.id) throw forbidden();
  if (session.status !== "active") throw new ApiError(410, "session_closed", "Esta partida ya ha terminado.");

  const now = new Date();
  const state = session.state as QuizState;
  const deadline = new Date(session.deadline_at);
  const startedAt = new Date(session.started_at);
  const grace = Number(cfg.quiz_grace_ms) || 1500;

  if (!isWithinDeadline(now, deadline, grace)) {
    const result = await finishQuiz(session.id, auth.user.id, state, startedAt, deadline, now, grace, session.flagged, session.flag_reason);
    return c.json({ timeout: true, finished: true, result });
  }
  if (body.position !== state.current) throw new ApiError(409, "out_of_order", "Respuesta fuera de orden.");
  const q = state.questions[state.current];
  if (!q) throw new ApiError(409, "out_of_order", "No hay más preguntas.");

  const servedAt = new Date(state.served_at[state.current] ?? session.started_at);
  const elapsed = now.getTime() - servedAt.getTime();
  const correct = body.choice === q.correct;
  if (elapsed < (Number(cfg.quiz_min_answer_ms) || 350)) state.fast_answers += 1;
  if (correct) state.correct_count += 1;

  // La restricción única (session_id, position) impide contar dos veces la misma respuesta
  const { error: answerError } = await db.from("game_answers").insert({ session_id: session.id, question_id: q.id, position: state.current, chosen_index: body.choice, is_correct: correct, served_at: servedAt.toISOString(), answered_at: now.toISOString() });
  if (answerError) throw new ApiError(409, "duplicate_answer", "Esta pregunta ya se ha respondido.");
  await db.rpc("record_question_result", { p_question_id: q.id, p_correct: correct });

  const { data: original } = await db.from("game_questions").select("id, category, difficulty, question, options, correct_index, explanation").eq("id", q.id).maybeSingle();
  const flagged = session.flagged || state.fast_answers >= 3;
  const flagReason = flagged && !session.flagged ? `Respuestas demasiado rápidas (${state.fast_answers})` : session.flag_reason;

  state.current += 1;
  const total = state.questions.length;
  if (state.current >= total) {
    const result = await finishQuiz(session.id, auth.user.id, state, startedAt, deadline, now, grace, flagged, flagReason);
    return c.json({ correct, correct_index: q.correct, explanation: original?.explanation ?? "", finished: true, result });
  }

  state.served_at[state.current] = new Date().toISOString();
  await db.from("game_sessions").update({ state, flagged, flag_reason: flagReason }).eq("id", session.id);
  const nextQ = state.questions[state.current]!;
  const { data: nextRow } = await db.from("game_questions").select("id, category, difficulty, question, options, correct_index, explanation").eq("id", nextQ.id).single();
  return c.json({
    correct,
    correct_index: q.correct,
    explanation: original?.explanation ?? "",
    finished: false,
    server_now: new Date().toISOString(),
    question: publicQuestion(nextRow as QuestionRow, nextQ, state.current, total),
  });
});

games.post("/quiz/timeout", async (c) => {
  const { auth, cfg } = await guard(c);
  const body = await readJson(c, z.object({ session_id: z.uuid() }));
  const { data: session } = await admin().from("game_sessions").select("id, user_id, status, state, started_at, deadline_at, flagged, flag_reason").eq("id", body.session_id).eq("game", "quiz").maybeSingle();
  if (!session || session.user_id !== auth.user.id) throw notFound("Partida no encontrada.");
  if (session.status !== "active") return c.json({ finished: true, status: session.status });
  const now = new Date();
  const grace = Number(cfg.quiz_grace_ms) || 1500;
  if (isWithinDeadline(now, new Date(session.deadline_at), grace)) {
    // El reloj del navegador va adelantado: el servidor manda
    return c.json({ finished: false, server_now: now.toISOString(), deadline_at: session.deadline_at });
  }
  const result = await finishQuiz(session.id, auth.user.id, session.state as QuizState, new Date(session.started_at), new Date(session.deadline_at), now, grace, session.flagged, session.flag_reason);
  return c.json({ finished: true, result });
});

// ---------------------------------------------------------------------------
// Tres en raya contra Nova (servidor autoritativo)
// ---------------------------------------------------------------------------
interface TttState {
  board: Board;
  player: "X";
  nova: "O";
  moves: { by: "player" | "nova"; cell: number; at: string }[];
}

games.post("/ttt/start", async (c) => {
  const { auth, cfg } = await guard(c);
  const body = await readJson(c, z.object({ level: z.string().max(20) }));
  const level = cfg.ttt_levels[body.level];
  if (!level) throw new ApiError(422, "invalid_level", "Nivel no válido.");
  if ((await attemptsToday(auth.user.id, "tictactoe")) >= cfg.ttt_attempts_per_day) {
    throw new ApiError(429, "attempts_exhausted", "Has agotado las partidas de hoy. Vuelve mañana.");
  }
  await closeActive(auth.user.id, "tictactoe");
  const state: TttState = { board: emptyBoard(), player: "X", nova: "O", moves: [] };
  const { data: session, error } = await admin()
    .from("game_sessions")
    .insert({ user_id: auth.user.id, game: "tictactoe", status: "active", difficulty: body.level, state, ip_hash: ipHash(c), deadline_at: new Date(Date.now() + 30 * 60_000).toISOString() })
    .select("id")
    .single();
  if (error || !session) throw error ?? new Error("No se pudo iniciar la partida");
  return c.json({ session_id: session.id, board: state.board, level: body.level, rewarded: cfg.ttt_reward_levels.includes(body.level), you: "X" });
});

games.post("/ttt/move", async (c) => {
  const { auth, cfg } = await guard(c);
  const body = await readJson(c, z.object({ session_id: z.uuid(), cell: z.number().int().min(0).max(8) }));
  const db = admin();
  const { data: session } = await db.from("game_sessions").select("id, user_id, status, state, difficulty, started_at, deadline_at").eq("id", body.session_id).eq("game", "tictactoe").maybeSingle();
  if (!session) throw notFound("Partida no encontrada.");
  if (session.user_id !== auth.user.id) throw forbidden();
  if (session.status !== "active") throw new ApiError(410, "session_closed", "Esta partida ya ha terminado.");
  if (session.deadline_at && new Date(session.deadline_at) < new Date()) {
    await db.from("game_sessions").update({ status: "expired", finished_at: new Date().toISOString() }).eq("id", session.id);
    throw new ApiError(410, "session_closed", "La partida ha caducado.");
  }

  const state = session.state as TttState;
  if (state.board[body.cell] !== null) throw new ApiError(409, "occupied", "Esa casilla ya está ocupada.");

  const now = new Date();
  state.board[body.cell] = "X";
  state.moves.push({ by: "player", cell: body.cell, at: now.toISOString() });

  const finish = async (status: "won" | "lost" | "draw", line: number[] | null, novaCell: number | null) => {
    const duration = now.getTime() - new Date(session.started_at).getTime();
    await db.from("game_sessions").update({ status, state, finished_at: now.toISOString(), duration_ms: duration, score: status === "won" ? 1 : 0 }).eq("id", session.id);
    let coupon: IssuedCoupon | null = null;
    const rewarded = cfg.ttt_reward_levels.includes(session.difficulty);
    if (status === "won" && rewarded) coupon = await issueChallengeCoupon(auth.user.id, session.id, "tictactoe");
    return c.json({ board: state.board, nova_move: novaCell, status, line, rewarded, coupon });
  };

  let result = winnerOf(state.board);
  if (result.winner === "X") return finish("won", result.line, null);
  if (isFull(state.board)) return finish("draw", null, null);

  const mistakeRate = cfg.ttt_levels[session.difficulty]?.mistake_rate ?? 0.3;
  const cell = novaMove(state.board, "O", Math.min(1, Math.max(0, mistakeRate)));
  state.board[cell] = "O";
  state.moves.push({ by: "nova", cell, at: new Date().toISOString() });

  result = winnerOf(state.board);
  if (result.winner === "O") return finish("lost", result.line, cell);
  if (isFull(state.board)) return finish("draw", null, cell);

  await db.from("game_sessions").update({ state }).eq("id", session.id);
  return c.json({ board: state.board, nova_move: cell, status: "active", line: null });
});
