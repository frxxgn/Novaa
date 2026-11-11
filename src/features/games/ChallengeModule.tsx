import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Grid3x3, LockKeyhole, MailCheck, Timer, Ticket } from "lucide-react";
import { useAuth } from "@/app/auth";
import { useSite } from "@/app/site";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, ErrorState, Skeleton } from "@/components/ui/feedback";
import { Reveal } from "@/components/motion/Reveal";
import { Quiz } from "./Quiz";
import { TicTacToe } from "./TicTacToe";

export interface ChallengeStatus {
  enabled: boolean;
  verified: boolean;
  quiz: { questions: number; duration_seconds: number; attempts_left: number };
  tictactoe: { attempts_left: number; levels: { key: string; label: string; rewarded: boolean }[] };
  coupon_percent: number;
  coupon: { code: string; percent: number; expires_at: string; status: string } | null;
}

export default function ChallengeModule() {
  const { user, ready } = useAuth();
  const { settings } = useSite();
  const qc = useQueryClient();
  const [game, setGame] = useState<"quiz" | "ttt" | null>(null);
  const status = useQuery({ queryKey: ["challenge-status", user?.id], queryFn: () => api<ChallengeStatus>("/games/status"), enabled: Boolean(user) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["challenge-status"] });

  if (!settings.challenge.enabled) {
    return <div className="container-nv pb-24 text-center text-muted">Novalius Challenge no está disponible en este momento.</div>;
  }

  const cards = (
    <div className="grid gap-6 md:grid-cols-2">
      {[
        { key: "quiz" as const, icon: Timer, title: "Quiz relámpago", text: `${settings.challenge.quiz_questions} preguntas en ${settings.challenge.quiz_duration_seconds} segundos. Acierta todas para ganar.`, left: status.data?.quiz.attempts_left },
        { key: "ttt" as const, icon: Grid3x3, title: "Tres en raya contra Nova", text: "Elige dificultad y vence a Nova. Los niveles marcados dan recompensa.", left: status.data?.tictactoe.attempts_left },
      ].map((g, i) => (
        <Reveal key={g.key} delay={i * 0.08}>
          <button
            disabled={!user || !status.data?.verified || g.left === 0}
            onClick={() => setGame(g.key)}
            className="glass group relative flex h-full w-full flex-col overflow-hidden rounded-lg p-8 text-left transition-transform enabled:hover:-translate-y-1 disabled:cursor-not-allowed"
            data-cursor="card"
            data-cursor-label="Jugar"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-90" style={{ background: "radial-gradient(closest-side, var(--nv-primary), transparent)" }} />
            <g.icon className="size-9 text-lavender" />
            <h2 className="mt-10 font-display text-3xl tracking-tight">{g.title}</h2>
            <p className="mt-3 max-w-sm text-muted">{g.text}</p>
            <div className="mt-8 flex items-center gap-3 text-sm">
              {g.left !== undefined && <Badge tone={g.left > 0 ? "violet" : "warning"}>{g.left > 0 ? `${g.left} intentos hoy` : "Sin intentos hoy"}</Badge>}
              <span className="font-medium">Jugar →</span>
            </div>
          </button>
        </Reveal>
      ))}
    </div>
  );

  return (
    <div className="container-nv pb-[calc(var(--nv-section-space)*0.6)]">
      {status.data?.coupon && (
        <div className="mb-8 flex flex-col gap-3 rounded-lg border border-success/40 bg-success/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Ticket className="size-6 text-success" />
            <div>
              <p className="font-medium">Ya tienes tu cupón del {status.data.coupon.percent} %</p>
              <p className="text-sm text-muted">
                {status.data.coupon.code} · caduca el {formatDate(status.data.coupon.expires_at)} · estado: {status.data.coupon.status === "available" ? "disponible" : status.data.coupon.status}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted">Puedes seguir jugando por diversión: solo hay un cupón por cuenta.</p>
        </div>
      )}

      {!ready ? (
        <Skeleton className="h-72" />
      ) : !user ? (
        <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="glass rounded-lg p-8">
            <LockKeyhole className="size-8 text-lavender" />
            <h2 className="mt-6 font-display text-2xl">Inicia sesión para jugar</h2>
            <p className="mt-3 text-muted">Necesitamos asociar el cupón a tu cuenta para que sea único y personal.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/registro?next=/challenge">Crear cuenta</ButtonLink>
              <ButtonLink to="/login?next=/challenge" variant="outline">
                Iniciar sesión
              </ButtonLink>
            </div>
          </div>
          <div className="pointer-events-none opacity-60">{cards}</div>
        </div>
      ) : status.isLoading ? (
        <Skeleton className="h-72" />
      ) : status.error ? (
        <ErrorState error={status.error} onRetry={() => status.refetch()} />
      ) : !status.data?.verified ? (
        <div className="glass mx-auto max-w-xl rounded-lg p-8 text-center">
          <MailCheck className="mx-auto size-9 text-lavender" />
          <h2 className="mt-5 font-display text-2xl">Verifica tu correo</h2>
          <p className="mt-3 text-muted">Te enviamos un enlace al registrarte. Verifica tu correo para participar en los juegos.</p>
          <Link to="/cuenta/perfil" className="mt-5 inline-block text-sm text-lavender underline underline-offset-4">
            Reenviar verificación
          </Link>
        </div>
      ) : game === null ? (
        cards
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {game === "quiz" ? <Quiz onExit={() => { setGame(null); void refresh(); }} status={status.data} /> : <TicTacToe onExit={() => { setGame(null); void refresh(); }} status={status.data} />}
        </motion.div>
      )}
    </div>
  );
}
