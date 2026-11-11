import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Ban, Search } from "lucide-react";
import { useAuth } from "@/app/auth";
import { supabase } from "@/lib/supabase";
import { errorMessage } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/form";
import { Badge, Notice, Skeleton, useToast } from "@/components/ui/feedback";
import { AdminPage, BarList, Card, DataTable, Stat, Tabs } from "../components/ui";
import { FormFields } from "../components/FormFields";
import { ResourceManager } from "../components/ResourceManager";
import { useSetting } from "../hooks";

const CATS = ["tecnologia", "cultura", "logica", "ciencia", "internet", "curiosidades", "creatividad"];

export default function ChallengeAdmin() {
  const { can } = useAuth();
  const games = can("games.manage");
  const [tab, setTab] = useState<"rules" | "questions" | "coupons" | "stats">(games ? "rules" : "coupons");
  return (
    <AdminPage
      title="Novalius Challenge"
      description="Reglas de los juegos, banco de preguntas, cupones y estadísticas. Los resultados se validan siempre en el servidor."
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[...(games ? [{ value: "rules" as const, label: "Reglas" }, { value: "questions" as const, label: "Preguntas" }] : []), { value: "coupons" as const, label: "Cupones" }, ...(games ? [{ value: "stats" as const, label: "Estadísticas" }] : [])]}
        />
      }
    >
      {tab === "rules" && <Rules />}
      {tab === "questions" && (
        <ResourceManager
          config={{
            table: "game_questions",
            permission: "games.manage",
            title: "Preguntas",
            singular: "pregunta",
            visibilityField: "is_active",
            orderBy: [{ column: "category" }, { column: "difficulty" }],
            searchKeys: ["question", "category"],
            defaults: { category: "tecnologia", difficulty: 2, question: "", options: ["", "", "", ""], correct_index: 0, explanation: "", is_active: true },
            beforeSave: (r) => {
              const options = (r.options as string[]).map((o) => o.trim()).filter(Boolean);
              if (options.length < 2) throw new Error("Añade al menos dos opciones.");
              const idx = Number(r.correct_index);
              if (!(idx >= 0 && idx < options.length)) throw new Error("El índice de la respuesta correcta no corresponde a ninguna opción.");
              const { times_shown: _a, times_correct: _b, ...rest } = r;
              void _a;
              void _b;
              return { ...rest, options, correct_index: idx, difficulty: Number(r.difficulty) };
            },
            columns: [
              { key: "question", label: "Pregunta", render: (r) => <span className="line-clamp-2">{String(r.question)}</span> },
              { key: "category", label: "Categoría", hideOnMobile: true, render: (r) => <Badge tone="violet">{String(r.category)}</Badge> },
              { key: "difficulty", label: "Dificultad", render: (r) => "●".repeat(Number(r.difficulty)) },
              { key: "accuracy", label: "Aciertos", hideOnMobile: true, render: (r) => (Number(r.times_shown) ? `${Math.round((100 * Number(r.times_correct)) / Number(r.times_shown))} % de ${String(r.times_shown)}` : "—") },
            ],
            fields: [
              { name: "question", label: "Pregunta", type: "textarea", required: true },
              { name: "options", label: "Opciones (en orden)", type: "strings", help: "Las opciones se barajan en cada partida." },
              { name: "correct_index", label: "Opción correcta (posición, empezando en 0)", type: "number", min: 0, max: 4 },
              { name: "category", label: "Categoría", type: "select", options: CATS.map((c) => ({ value: c, label: c })) },
              { name: "difficulty", label: "Dificultad", type: "select", options: [{ value: "1", label: "Fácil" }, { value: "2", label: "Media" }, { value: "3", label: "Difícil" }] },
              { name: "explanation", label: "Explicación (opcional)", type: "textarea" },
              { name: "is_active", label: "Activa", type: "switch" },
            ],
          }}
        />
      )}
      {tab === "coupons" && <Coupons />}
      {tab === "stats" && <Stats />}
    </AdminPage>
  );
}

function Rules() {
  const { query, save } = useSetting("challenge", {} as Record<string, unknown>);
  const [v, setV] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    if (query.data) setV(query.data);
  }, [query.data]);
  if (!v) return <Skeleton className="h-96" />;
  const levels = (v.ttt_levels ?? {}) as Record<string, { label: string; mistake_rate: number }>;
  const rewarded = (v.ttt_reward_levels ?? []) as string[];
  const mix = (v.quiz_mix ?? {}) as Record<string, number>;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="General y recompensa">
        <FormFields
          fields={[
            { name: "enabled", label: "Challenge activo", type: "switch" },
            { name: "coupon_percent", label: "Descuento del cupón (%)", type: "number", min: 1, max: 50 },
            { name: "coupon_valid_days", label: "Validez del cupón (días)", type: "number", min: 1, max: 730 },
            { name: "coupon_conditions", label: "Condiciones del cupón", type: "textarea" },
          ]}
          value={v}
          onChange={setV}
        />
        <p className="mt-3 text-xs text-muted">Siempre se concede como máximo un cupón por cuenta (garantizado por la base de datos).</p>
      </Card>
      <Card title="Quiz">
        <FormFields
          fields={[
            { name: "quiz_questions", label: "Número de preguntas", type: "number", min: 3, max: 20 },
            { name: "quiz_duration_seconds", label: "Tiempo total (segundos)", type: "number", min: 15, max: 300 },
            { name: "quiz_attempts_per_day", label: "Intentos por día", type: "number", min: 1, max: 50 },
            { name: "quiz_grace_ms", label: "Margen de red (ms)", type: "number", min: 0, max: 5000, help: "Tolerancia por latencia entre el navegador y el servidor." },
            { name: "quiz_min_answer_ms", label: "Tiempo mínimo humano por respuesta (ms)", type: "number", min: 0, max: 3000, help: "Tres respuestas más rápidas que esto marcan la partida como sospechosa (sin premio)." },
          ]}
          value={v}
          onChange={setV}
        />
        <p className="mb-2 mt-4 text-sm font-medium">Mezcla de dificultad</p>
        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3"].map((k) => (
            <Input key={k} label={{ "1": "Fáciles", "2": "Medias", "3": "Difíciles" }[k]} type="number" min={0} max={20} value={mix[k] ?? 0} onChange={(e) => setV({ ...v, quiz_mix: { ...mix, [k]: Number(e.target.value) } })} />
          ))}
        </div>
      </Card>
      <Card title="Tres en raya" description="Tasa de error = probabilidad de que Nova elija una jugada no óptima. Con 0 Nova es imbatible: no la uses en niveles con premio.">
        <div className="space-y-3">
          {Object.entries(levels).map(([k, lvl]) => (
            <div key={k} className="grid grid-cols-[1fr_120px_auto] items-end gap-3">
              <Input label="Nivel" value={lvl.label} onChange={(e) => setV({ ...v, ttt_levels: { ...levels, [k]: { ...lvl, label: e.target.value } } })} />
              <Input label="Tasa de error" type="number" step={0.05} min={0} max={1} value={lvl.mistake_rate} onChange={(e) => setV({ ...v, ttt_levels: { ...levels, [k]: { ...lvl, mistake_rate: Math.min(1, Math.max(0, Number(e.target.value))) } } })} />
              <label className="flex h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="accent-[var(--nv-primary)]" checked={rewarded.includes(k)} onChange={(e) => setV({ ...v, ttt_reward_levels: e.target.checked ? [...rewarded, k] : rewarded.filter((x) => x !== k) })} /> Premio
              </label>
            </div>
          ))}
        </div>
        {Object.entries(levels).some(([k, l]) => rewarded.includes(k) && l.mistake_rate <= 0) && <Notice tone="warning" className="mt-3">Hay un nivel con premio en el que Nova no comete errores: sería imposible ganar.</Notice>}
        <FormFields fields={[{ name: "ttt_attempts_per_day", label: "Partidas por día", type: "number", min: 1, max: 100 }]} value={v} onChange={setV} />
      </Card>
      <div className="lg:col-span-2">
        <Button loading={save.isPending} onClick={() => save.mutate(v)}>
          Guardar reglas
        </Button>
      </div>
    </div>
  );
}

interface CouponRow {
  id: string;
  code: string;
  percent: number;
  status: string;
  source: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
  revoked_reason: string;
  profiles: { email: string } | null;
}

function Coupons() {
  const toast = useToast();
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [check, setCheck] = useState<{ valid: boolean; reason: string; percent?: number; expires_at?: string; user_email?: string } | null>(null);
  const q = useQuery({ queryKey: ["admin", "coupons"], queryFn: async () => ((await supabase.from("coupons").select("id, code, percent, status, source, expires_at, created_at, used_at, revoked_reason, profiles(email)").order("created_at", { ascending: false }).limit(1000)).data ?? []) as unknown as CouponRow[] });
  const validate = async () => {
    const { data, error } = await supabase.rpc("validate_coupon", { p_code: code });
    if (error) toast("error", "No se pudo validar", errorMessage(error));
    else setCheck(data as typeof check);
  };
  const redeem = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("redeem_coupon", { p_code: code, p_quote_id: null, p_project_id: null, p_amount: null, p_notes: "Canje desde el panel" });
      if (error) throw error;
      const r = data as { ok: boolean; reason?: string };
      if (!r.ok) throw new Error(`No canjeable: ${r.reason}`);
    },
    onSuccess: () => {
      toast("success", "Cupón canjeado", "Ya no puede volver a usarse.");
      setCheck(null);
      setCode("");
      void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
    },
    onError: (e) => toast("error", "No se pudo canjear", errorMessage(e)),
  });
  const revoke = async (c: CouponRow) => {
    const reason = window.prompt("Motivo de la revocación:", "Uso indebido");
    if (reason === null) return;
    const { error } = await supabase.from("coupons").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: reason.slice(0, 200) }).eq("id", c.id);
    if (error) toast("error", "No se pudo revocar", errorMessage(error));
    else void qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
  };
  const statusOf = (c: CouponRow) => (c.status === "available" && new Date(c.expires_at) < new Date() ? "expired" : c.status);
  return (
    <div className="space-y-6">
      <Card title="Validar y canjear" description="Introduce el código que te indique el cliente al contratar.">
        <div className="flex flex-wrap items-end gap-2">
          <Input label="Código" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="NOVA-XXXX-XXXX" wrapperClassName="min-w-56 flex-1" />
          <Button variant="outline" icon={<Search className="size-4" />} onClick={() => void validate()} disabled={!code}>
            Validar
          </Button>
          <Button icon={<BadgeCheck className="size-4" />} disabled={!check?.valid} loading={redeem.isPending} onClick={() => redeem.mutate()}>
            Canjear
          </Button>
        </div>
        {check && (
          <Notice tone={check.valid ? "success" : "danger"} className="mt-4">
            {check.valid ? `Válido: ${check.percent} % · ${check.user_email ?? ""} · caduca el ${formatDate(check.expires_at)}` : `No válido (${{ not_found: "no existe", used: "ya utilizado", expired: "caducado", revoked: "revocado" }[check.reason] ?? check.reason})`}
          </Notice>
        )}
      </Card>
      <DataTable
        rows={q.data}
        loading={q.isLoading}
        searchKeys={["code", (r) => r.profiles?.email ?? ""]}
        columns={[
          { key: "code", label: "Código", render: (r) => <code className="font-mono text-xs">{r.code}</code> },
          { key: "user", label: "Usuario", render: (r) => r.profiles?.email ?? "—" },
          { key: "percent", label: "%", render: (r) => `${Number(r.percent)} %` },
          { key: "status", label: "Estado", render: (r) => { const s = statusOf(r); return <Badge tone={s === "available" ? "success" : s === "used" ? "info" : "danger"}>{{ available: "Disponible", used: "Usado", expired: "Caducado", revoked: "Revocado" }[s]}</Badge>; } },
          { key: "expires_at", label: "Caduca", hideOnMobile: true, render: (r) => formatDate(r.expires_at) },
          { key: "created_at", label: "Emitido", hideOnMobile: true, render: (r) => timeAgo(r.created_at) },
          { key: "actions", label: "", render: (r) => statusOf(r) === "available" && <button className="rounded p-1.5 text-muted hover:text-danger" title="Revocar" aria-label="Revocar" onClick={() => void revoke(r)}><Ban className="size-4" /></button> },
        ]}
      />
    </div>
  );
}

function Stats() {
  const q = useQuery({ queryKey: ["admin", "challenge-stats"], queryFn: async () => (await supabase.rpc("challenge_stats")).data as { sessions: Record<string, number>; players: number; flagged: number; avg_quiz_ms: number; questions: { id: string; question: string; shown: number; correct: number; accuracy: number | null }[]; coupons: Record<string, number> } });
  const flagged = useQuery({ queryKey: ["admin", "flagged-sessions"], queryFn: async () => ((await supabase.from("game_sessions").select("id, game, score, flag_reason, created_at, profiles(email)").eq("flagged", true).order("created_at", { ascending: false }).limit(50)).data ?? []) as unknown as { id: string; game: string; score: number; flag_reason: string; created_at: string; profiles: { email: string } | null }[] });
  if (!q.data) return <Skeleton className="h-64" />;
  const s = q.data.sessions;
  const total = (game: string) => Object.entries(s).filter(([k]) => k.startsWith(game)).reduce((a, [, n]) => a + n, 0);
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Jugadores" value={q.data.players} />
        <Stat label="Partidas de quiz" value={total("quiz")} hint={`${s["quiz:won"] ?? 0} ganadas`} />
        <Stat label="Partidas de tres en raya" value={total("tictactoe")} hint={`${s["tictactoe:won"] ?? 0} ganadas · ${s["tictactoe:draw"] ?? 0} empates`} />
        <Stat label="Partidas sospechosas" value={q.data.flagged} tone={q.data.flagged ? "warning" : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Preguntas más difíciles" description="Porcentaje de acierto (mínimo 1 aparición)">
          <BarList items={q.data.questions.filter((x) => x.shown > 0).sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0)).slice(0, 8).map((x) => ({ label: x.question, value: x.accuracy ?? 0 }))} color="var(--nv-secondary)" />
        </Card>
        <Card title="Partidas marcadas para revisión">
          <ul className="space-y-2 text-sm">
            {(flagged.data ?? []).map((f) => (
              <li key={f.id} className="rounded-sm border border-tone p-2.5">
                {f.profiles?.email ?? "—"} · {f.game} · {f.flag_reason} · {timeAgo(f.created_at)}
              </li>
            ))}
            {flagged.data?.length === 0 && <li className="text-muted">Ninguna.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
