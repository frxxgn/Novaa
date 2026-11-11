import { useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { usePrefs } from "@/app/prefs";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/Button";
import { Badge, Notice } from "@/components/ui/feedback";
import { NovaAvatar } from "@/components/brand/Logo";
import { CouponReveal, type IssuedCoupon } from "./CouponReveal";
import type { ChallengeStatus } from "./ChallengeModule";

type Cell = "X" | "O" | null;

export function TicTacToe({ onExit, status }: { onExit: () => void; status: ChallengeStatus }) {
  const { playTick } = usePrefs();
  const [level, setLevel] = useState(status.tictactoe.levels.find((l) => l.rewarded)?.key ?? status.tictactoe.levels[0]?.key ?? "normal");
  const [session, setSession] = useState<string | null>(null);
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [state, setState] = useState<"idle" | "player" | "nova" | "won" | "lost" | "draw">("idle");
  const [line, setLine] = useState<number[] | null>(null);
  const [coupon, setCoupon] = useState<IssuedCoupon | null>(null);
  const [rewarded, setRewarded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const start = async () => {
    setError(null);
    setLoading(true);
    try {
      const r = await api<{ session_id: string; board: Cell[]; rewarded: boolean }>("/games/ttt/start", { body: { level } });
      setSession(r.session_id);
      setBoard(r.board);
      setRewarded(r.rewarded);
      setLine(null);
      setCoupon(null);
      setState("player");
      track("game_start", { game: "tictactoe", level });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const play = async (cell: number) => {
    if (state !== "player" || board[cell] || !session) return;
    playTick("click");
    const optimistic = [...board];
    optimistic[cell] = "X";
    setBoard(optimistic);
    setState("nova");
    try {
      const r = await api<{ board: Cell[]; nova_move: number | null; status: "active" | "won" | "lost" | "draw"; line: number[] | null; coupon?: IssuedCoupon | null }>("/games/ttt/move", { body: { session_id: session, cell } });
      // Pequeña pausa para que el movimiento de Nova se perciba
      await new Promise((res) => setTimeout(res, r.nova_move !== null ? 380 : 0));
      setBoard(r.board);
      setLine(r.line);
      if (r.status === "active") setState("player");
      else {
        setState(r.status);
        if (r.coupon) setCoupon(r.coupon);
        playTick(r.status === "won" ? "success" : r.status === "lost" ? "error" : "click");
      }
    } catch (e) {
      setError(errorMessage(e));
      setBoard(board);
      setState("player");
    }
  };

  const finished = state === "won" || state === "lost" || state === "draw";

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
      <div className="glass rounded-lg p-6 md:p-10">
        {state === "idle" ? (
          <div className="text-center">
            <h2 className="font-display text-3xl">Tres en raya contra Nova</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">Tú juegas con X y empiezas. Nova piensa con estrategia real (minimax) y, según el nivel, comete más o menos errores.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3" role="radiogroup" aria-label="Dificultad">
              {status.tictactoe.levels.map((l) => (
                <button key={l.key} role="radio" aria-checked={level === l.key} onClick={() => setLevel(l.key)} className={cn("rounded-sm border px-5 py-3 text-left", level === l.key ? "border-lavender bg-white/10" : "border-tone hover:bg-white/5")}>
                  <span className="block font-medium">{l.label}</span>
                  <span className="text-xs text-muted">{l.rewarded ? `Premio: −${status.coupon_percent} %` : "Sin premio"}</span>
                </button>
              ))}
            </div>
            <Button size="lg" className="mt-8" onClick={start} loading={loading} disabled={status.tictactoe.attempts_left <= 0}>
              Empezar partida
            </Button>
            <p className="mt-3 text-xs text-muted">{status.tictactoe.attempts_left} partidas disponibles hoy.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-6 flex w-full items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary font-display text-white">X</span> Tú
              </span>
              <Badge tone={rewarded ? "violet" : "neutral"}>{rewarded ? "Partida con premio" : "Sin premio"}</Badge>
              <span className="flex items-center gap-2">
                Nova <NovaAvatar className="size-7" pulse={state === "nova"} />
              </span>
            </div>
            <p className="mb-5 h-6 text-center text-sm text-muted" aria-live="polite">
              {state === "player" && "Tu turno"}
              {state === "nova" && "Nova está pensando…"}
              {state === "won" && "¡Has ganado a Nova!"}
              {state === "lost" && "Nova gana esta vez"}
              {state === "draw" && "Empate"}
            </p>
            <div className="grid w-full max-w-[360px] grid-cols-3 gap-2.5" role="grid" aria-label="Tablero">
              {board.map((c, i) => (
                <button
                  key={i}
                  role="gridcell"
                  aria-label={`Casilla ${i + 1}${c ? `, ${c === "X" ? "tuya" : "de Nova"}` : ", libre"}`}
                  onClick={() => play(i)}
                  disabled={state !== "player" || Boolean(c)}
                  className={cn("relative flex aspect-square items-center justify-center rounded-md border border-tone bg-white/[0.03] transition-colors", state === "player" && !c && "hover:border-lavender hover:bg-white/[0.08]", line?.includes(i) && "border-secondary bg-secondary/20")}
                >
                  {c && (
                    <motion.span initial={{ scale: 0.3, opacity: 0, rotate: -30 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: "spring", damping: 12, stiffness: 260 }} className={cn("font-display text-5xl md:text-6xl", c === "X" ? "text-[var(--tone-fg)]" : "text-gradient")}>
                      {c === "X" ? "×" : "○"}
                    </motion.span>
                  )}
                </button>
              ))}
            </div>
            {finished && (
              <div className="mt-8 w-full">
                {state === "won" && coupon && <CouponReveal coupon={coupon} />}
                {state === "won" && !rewarded && <p className="text-center text-sm text-muted">¡Bien jugado! Prueba en un nivel con premio para ganar el cupón.</p>}
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button onClick={start} icon={<RotateCcw className="size-4" />} variant="outline" loading={loading}>
                    Revancha
                  </Button>
                  <Button onClick={() => setState("idle")} variant="ghost">
                    Cambiar nivel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
