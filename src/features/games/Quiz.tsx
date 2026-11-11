import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Check, RotateCcw, Timer, X } from "lucide-react";
import { usePrefs } from "@/app/prefs";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/feedback";
import { CouponReveal, type IssuedCoupon } from "./CouponReveal";
import type { ChallengeStatus } from "./ChallengeModule";

interface Question {
  position: number;
  total: number;
  category: string;
  difficulty: number;
  question: string;
  options: string[];
}

interface Result {
  status: "won" | "lost" | "expired";
  score: number;
  total: number;
  duration_ms: number;
  in_time: boolean;
  flagged: boolean;
  coupon: IssuedCoupon | null;
}

const CATEGORY: Record<string, string> = { tecnologia: "Tecnología", cultura: "Cultura general", logica: "Lógica", ciencia: "Ciencia", internet: "Internet", curiosidades: "Curiosidades", creatividad: "Creatividad" };

export function Quiz({ onExit, status }: { onExit: () => void; status: ChallengeStatus }) {
  const { playTick } = usePrefs();
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [session, setSession] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [feedback, setFeedback] = useState<{ chosen: number; correct: number; ok: boolean } | null>(null);
  const [deadline, setDeadline] = useState<number>(0);
  const [offset, setOffset] = useState(0); // diferencia reloj servidor - navegador
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timeoutSent = useRef(false);
  const duration = status.quiz.duration_seconds * 1000;

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const remaining = Math.max(0, deadline - (now + offset));

  const finish = useCallback((r: Result) => {
    setResult(r);
    setPhase("result");
    playTick(r.status === "won" ? "success" : "error");
  }, [playTick]);

  // Al agotarse el tiempo (según el reloj del servidor) se solicita el cierre
  useEffect(() => {
    if (phase !== "playing" || remaining > 0 || timeoutSent.current || !session) return;
    timeoutSent.current = true;
    const check = async () => {
      try {
        const r = await api<{ finished: boolean; result?: Result; deadline_at?: string; server_now?: string }>("/games/quiz/timeout", { body: { session_id: session } });
        if (r.finished && r.result) finish(r.result);
        else if (r.finished) finish({ status: "expired", score, total: status.quiz.questions, duration_ms: duration, in_time: false, flagged: false, coupon: null });
        else {
          timeoutSent.current = false;
          if (r.server_now) setOffset(new Date(r.server_now).getTime() - Date.now());
          setTimeout(check, 900);
        }
      } catch (e) {
        setError(errorMessage(e));
      }
    };
    void check();
  }, [remaining, phase, session, finish, score, status.quiz.questions, duration]);

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ session_id: string; server_now: string; deadline_at: string; question: Question }>("/games/quiz/start", { body: {} });
      setOffset(new Date(r.server_now).getTime() - Date.now());
      setDeadline(new Date(r.deadline_at).getTime());
      setSession(r.session_id);
      setQuestion(r.question);
      setScore(0);
      setFeedback(null);
      timeoutSent.current = false;
      setPhase("playing");
      track("game_start", { game: "quiz" });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const answer = async (choice: number) => {
    if (!session || !question || feedback || loading) return;
    setLoading(true);
    try {
      const r = await api<{ correct: boolean; correct_index: number; finished: boolean; result?: Result; timeout?: boolean; question?: Question; server_now?: string }>("/games/quiz/answer", { body: { session_id: session, position: question.position, choice } });
      if (r.timeout && r.result) {
        finish(r.result);
        return;
      }
      setFeedback({ chosen: choice, correct: r.correct_index, ok: r.correct });
      playTick(r.correct ? "success" : "error");
      if (r.correct) setScore((s) => s + 1);
      if (r.server_now) setOffset(new Date(r.server_now).getTime() - Date.now());
      setTimeout(() => {
        setFeedback(null);
        if (r.finished && r.result) finish(r.result);
        else if (r.question) setQuestion(r.question);
      }, 650);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const pct = duration ? remaining / duration : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <button onClick={onExit} className="mb-6 inline-flex items-center gap-2 text-sm text-muted hover:text-[var(--tone-fg)]">
        <ArrowLeft className="size-4" /> Volver a los juegos
      </button>
      {error && (
        <Notice tone="danger" className="mb-6">
          {error}
        </Notice>
      )}

      {phase === "intro" && (
        <div className="glass rounded-lg p-8 text-center md:p-12">
          <Timer className="mx-auto size-10 text-lavender" />
          <h2 className="mt-6 font-display text-3xl">Quiz relámpago</h2>
          <ul className="mx-auto mt-6 max-w-md space-y-2 text-left text-muted">
            <li>• {status.quiz.questions} preguntas variadas, de menos a más difíciles.</li>
            <li>• {status.quiz.duration_seconds} segundos en total, medidos por nuestro servidor.</li>
            <li>• Acierta todas para ganar un cupón del {status.coupon_percent} %.</li>
            <li>• Te quedan {status.quiz.attempts_left} intentos hoy.</li>
          </ul>
          <Button size="lg" className="mt-8" onClick={start} loading={loading} disabled={status.quiz.attempts_left <= 0} magnetic>
            Empezar
          </Button>
        </div>
      )}

      {phase === "playing" && question && (
        <div className="glass overflow-hidden rounded-lg">
          <div className="h-1.5 w-full bg-white/10" role="progressbar" aria-label="Tiempo restante" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
            <div className={cn("h-full transition-[width] duration-100 ease-linear", pct < 0.2 ? "bg-danger" : "bg-gradient-to-r from-primary to-secondary")} style={{ width: `${pct * 100}%` }} />
          </div>
          <div className="p-6 md:p-10">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">
                Pregunta <strong className="text-[var(--tone-fg)]">{question.position + 1}</strong> de {question.total}
              </span>
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono", pct < 0.2 ? "bg-danger/20 text-danger" : "bg-white/10")} aria-live="off">
                <Timer className="size-4" /> {(remaining / 1000).toFixed(1)} s
              </span>
            </div>
            <div className="mt-4 flex gap-1" aria-hidden>
              {Array.from({ length: question.total }, (_, i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", i < question.position ? "bg-secondary" : i === question.position ? "bg-white/60" : "bg-white/10")} />
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={question.position} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <p className="mt-8 font-mono text-xs uppercase tracking-widest text-lavender">
                  {CATEGORY[question.category] ?? question.category} · {"●".repeat(question.difficulty)}
                  {"○".repeat(3 - question.difficulty)}
                </p>
                <h3 className="mt-3 font-display text-2xl leading-snug md:text-3xl">{question.question}</h3>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  {question.options.map((o, i) => {
                    const isChosen = feedback?.chosen === i;
                    const isCorrect = feedback?.correct === i;
                    return (
                      <motion.button
                        key={i}
                        onClick={() => answer(i)}
                        disabled={Boolean(feedback) || loading}
                        animate={feedback && isChosen && !feedback.ok ? { x: [0, -8, 8, -5, 5, 0] } : feedback && isCorrect ? { scale: [1, 1.03, 1] } : {}}
                        className={cn(
                          "flex min-h-14 items-center justify-between gap-3 rounded-sm border px-5 py-3 text-left transition-colors",
                          !feedback && "border-tone hover:border-lavender hover:bg-white/5",
                          feedback && isCorrect && "border-success bg-success/15",
                          feedback && isChosen && !feedback.ok && "border-danger bg-danger/15",
                          feedback && !isChosen && !isCorrect && "border-tone opacity-50",
                        )}
                      >
                        <span>{o}</span>
                        {feedback && isCorrect && <Check className="size-5 text-success" />}
                        {feedback && isChosen && !feedback.ok && <X className="size-5 text-danger" />}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
            <p className="mt-6 text-sm text-muted">Aciertos: {score}</p>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="glass rounded-lg p-8 text-center md:p-12">
          <p className="eyebrow text-lavender">{result.status === "won" ? "¡Reto superado!" : result.status === "expired" ? "Se acabó el tiempo" : "Casi lo tienes"}</p>
          <p className="mt-4 font-display text-6xl tracking-tighter">
            {result.score}
            <span className="text-2xl text-muted">/{result.total}</span>
          </p>
          <p className="mt-2 text-muted">Tiempo: {(Math.min(result.duration_ms, duration) / 1000).toFixed(1)} s</p>
          {result.flagged && <p className="mt-3 text-sm text-warning">La partida se ha marcado para revisión por respuestas anormalmente rápidas.</p>}
          {result.status === "won" && result.coupon && (
            <div className="mt-8">
              <CouponReveal coupon={result.coupon} />
            </div>
          )}
          {result.status !== "won" && <p className="mx-auto mt-4 max-w-md text-muted">Para ganar hay que acertar las {result.total} preguntas dentro del tiempo. Las preguntas cambian en cada partida.</p>}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={() => { setPhase("intro"); setResult(null); }} icon={<RotateCcw className="size-4" />} variant="outline">
              Jugar otra vez
            </Button>
            <Button onClick={onExit} variant="ghost">
              Elegir otro juego
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
