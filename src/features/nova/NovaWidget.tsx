import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUp, History, Loader2, MoreHorizontal, RotateCcw, Square, X } from "lucide-react";
import { useAuth } from "@/app/auth";
import { usePrefs } from "@/app/prefs";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { Markdown } from "@/lib/markdown";
import { cn, timeAgo } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { NovaAvatar } from "@/components/brand/Logo";
import { ContactCard } from "./ContactCard";
import { QuoteCard } from "./QuoteCard";
import { useNova, type NovaMessage } from "./useNova";

/** Abre Nova desde cualquier parte (opcionalmente con un mensaje inicial). */
export function openNova(message?: string) {
  window.dispatchEvent(new CustomEvent("nova:open", { detail: { message } }));
}

export function NovaWidget() {
  const nova = useNova();
  const { t } = useI18n();
  const { user } = useAuth();
  const { playTick } = usePrefs();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [menu, setMenu] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showContact, setShowContact] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<string | null>(null);

  const history = useQuery({
    queryKey: ["nova-history", user?.id],
    queryFn: () => api<{ conversations: { id: string; title: string; last_message_at: string; message_count: number }[] }>("/nova/conversations"),
    enabled: Boolean(user) && historyOpen,
  });

  useEffect(() => {
    const onOpen = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      pending.current = msg ?? null;
      setOpen(true);
    };
    window.addEventListener("nova:open", onOpen);
    return () => window.removeEventListener("nova:open", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    track("nova_open");
    void nova
      .ensure()
      .then(() => {
        if (pending.current) {
          const m = pending.current;
          pending.current = null;
          void nova.send(m);
        }
      })
      .catch(() => undefined);
    setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [nova.messages, open]);

  const lastAssistant = [...nova.messages].reverse().find((m) => m.role === "assistant");
  const config = nova.config;
  if (config && !config.enabled) return null;

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (nova.busy) return;
    const value = text.trim();
    if (!value) return;
    setText("");
    setSelected([]);
    playTick("click");
    void nova.send(value);
  };

  const quick = (option: string, multi?: boolean) => {
    if (multi) {
      setSelected((s) => (s.includes(option) ? s.filter((x) => x !== option) : [...s, option]));
      return;
    }
    playTick("click");
    void nova.send(option);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            key="launcher"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", damping: 20, stiffness: 260, delay: 0.4 }}
            onClick={() => setOpen(true)}
            className="group fixed bottom-[max(16px,env(safe-area-inset-bottom))] right-4 z-[120] flex items-center gap-3 rounded-full border border-white/15 bg-[color-mix(in_oklab,var(--nv-surface-dark)_88%,transparent)] py-2 pl-2 pr-2 text-white shadow-[0_20px_60px_-15px_var(--nv-primary)] backdrop-blur-xl transition-[padding] sm:right-6 sm:pr-5"
            aria-label={t("nova.open")}
            data-cursor="button"
          >
            <NovaAvatar className="size-11" pulse />
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold leading-tight">{t("nova.open")}</span>
              <span className="block text-xs text-white/60">{config?.mode === "ai" ? "Asistente con IA" : t("nova.subtitle")}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label="Nova, asistente de Novalius"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 280 }}
            className="tone-dark fixed inset-0 z-[160] flex flex-col overflow-hidden border-white/12 shadow-[0_40px_120px_-30px_rgba(0,0,0,.8)] sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(720px,calc(100dvh-48px))] sm:w-[420px] sm:rounded-lg sm:border"
            style={{ background: "linear-gradient(180deg, var(--nv-surface-dark), var(--nv-bg-dark))" }}
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70" style={{ background: "radial-gradient(70% 100% at 20% 0%, color-mix(in oklab, var(--nv-primary) 45%, transparent), transparent)" }} />
            <header className="relative flex items-center gap-3 border-b border-white/10 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
              <NovaAvatar className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-base leading-tight">{config?.name ?? "Nova"}</p>
                <p className="flex items-center gap-1.5 text-xs text-white/60">
                  <span className={cn("size-1.5 rounded-full", nova.mode === "ai" ? "bg-success" : "bg-warning")} />
                  {nova.mode === "ai" ? "Asistente con IA · en línea" : t("nova.guided")}
                </p>
              </div>
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label="Opciones" aria-expanded={menu}>
                  <MoreHorizontal className="size-5" />
                </button>
                {menu && (
                  <div className="absolute right-0 top-11 z-10 w-56 overflow-hidden rounded-sm border border-white/10 bg-[var(--nv-surface-dark)] py-1 text-sm shadow-2xl">
                    <button
                      className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10"
                      onClick={() => {
                        setMenu(false);
                        setShowContact(null);
                        void nova.reset();
                      }}
                    >
                      <RotateCcw className="size-4" /> {t("nova.new")}
                    </button>
                    {user && (
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10"
                        onClick={() => {
                          setMenu(false);
                          setHistoryOpen(true);
                        }}
                      >
                        <History className="size-4" /> {t("nova.history")}
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-white/70 hover:bg-white/10" aria-label={t("nova.close")}>
                <X className="size-5" />
              </button>
            </header>

            {historyOpen && (
              <div className="relative border-b border-white/10 bg-white/[0.03] px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs text-white/60">
                  <span>{t("nova.history")}</span>
                  <button onClick={() => setHistoryOpen(false)} aria-label="Cerrar historial">
                    <X className="size-4" />
                  </button>
                </div>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {history.isLoading && <li className="text-white/50">Cargando…</li>}
                  {history.data?.conversations.length === 0 && <li className="text-white/50">Sin conversaciones guardadas.</li>}
                  {history.data?.conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        className="flex w-full justify-between gap-2 rounded px-2 py-1.5 text-left hover:bg-white/10"
                        onClick={() => {
                          setHistoryOpen(false);
                          void nova.openConversation(c.id);
                        }}
                      >
                        <span className="truncate">{c.title || "Conversación"}</span>
                        <span className="shrink-0 text-xs text-white/45">{timeAgo(c.last_message_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div ref={listRef} className="relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5" data-lenis-prevent aria-live="polite">
              {config?.ai_disclosure && <p className="mx-auto max-w-[90%] text-center text-[11px] leading-snug text-white/40">{config.ai_disclosure}</p>}
              {nova.mode === "guided" && <p className="mx-auto max-w-[90%] text-center text-[11px] leading-snug text-warning/80">{t("nova.guided_hint")}</p>}
              {!nova.loaded && (
                <div className="flex justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-white/50" />
                </div>
              )}
              {nova.messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  isLast={m.id === lastAssistant?.id}
                  busy={nova.busy}
                  selected={selected}
                  onQuick={quick}
                  onConfirmMulti={() => {
                    const s = selected;
                    setSelected([]);
                    void nova.send("", s.length ? s : ["Ninguna en especial"]);
                  }}
                  whatsapp={config?.whatsapp ?? null}
                  leadSent={nova.leadSent}
                  showContact={showContact === m.id || Boolean(m.contact)}
                  onProposal={() => {
                    if (nova.mode === "guided") void nova.send("Sí, quiero una propuesta");
                    else if (m.contact) setShowContact(m.id);
                    else void nova.send("Quiero una propuesta personalizada para este presupuesto.");
                  }}
                  onSubmitContact={nova.submitContact}
                />
              ))}
            </div>

            <form onSubmit={submit} className="relative border-t border-white/10 p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              <div className="flex items-end gap-2 rounded-[22px] border border-white/12 bg-white/[0.05] p-1.5 pl-4 focus-within:border-lavender">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={text}
                  maxLength={4000}
                  onChange={(e) => {
                    setText(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${Math.min(120, e.target.scrollHeight)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder={t("nova.placeholder")}
                  aria-label={t("nova.placeholder")}
                  className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent py-2 text-[0.95rem] text-white placeholder:text-white/40 focus:outline-none"
                />
                {nova.busy ? (
                  <button type="button" onClick={nova.stop} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white" aria-label="Detener">
                    <Square className="size-4" />
                  </button>
                ) : (
                  <button type="submit" disabled={!text.trim()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity disabled:opacity-40" aria-label={t("nova.send")}>
                    <ArrowUp className="size-5" />
                  </button>
                )}
              </div>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({
  m,
  isLast,
  busy,
  selected,
  onQuick,
  onConfirmMulti,
  whatsapp,
  leadSent,
  showContact,
  onProposal,
  onSubmitContact,
}: {
  m: NovaMessage;
  isLast: boolean;
  busy: boolean;
  selected: string[];
  onQuick: (o: string, multi?: boolean) => void;
  onConfirmMulti: () => void;
  whatsapp: { number: string; message: string } | null;
  leadSent: boolean;
  showContact: boolean;
  onProposal: () => void;
  onSubmitContact: Parameters<typeof ContactCard>[0]["onSubmit"];
}) {
  if (m.role === "event") {
    return <p className="text-center text-xs text-success">✓ {m.content}</p>;
  }
  const mine = m.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn("flex flex-col gap-2", mine ? "items-end" : "items-start")}>
      {(m.content || m.streaming) && (
        <div
          className={cn(
            "max-w-[88%] rounded-[20px] px-4 py-2.5 text-[0.93rem] leading-relaxed",
            mine ? "rounded-br-md bg-primary text-white" : "rounded-bl-md border border-white/10 bg-white/[0.06] text-white/90",
            m.error && "border-danger/40 bg-danger/10",
          )}
        >
          {m.content ? (
            <Markdown text={m.content} className="space-y-2 [&_a]:underline [&_ol]:space-y-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-4" />
          ) : (
            <span className="flex items-center gap-1 py-1" aria-label="Nova está escribiendo">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="size-1.5 rounded-full bg-lavender" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </span>
          )}
        </div>
      )}
      {m.status && (
        <p className="flex items-center gap-1.5 text-xs text-lavender">
          <Loader2 className="size-3.5 animate-spin" /> {m.status}
        </p>
      )}
      {m.quote && (
        <div className="w-full max-w-[94%]">
          <QuoteCard quote={m.quote} onProposal={leadSent ? undefined : onProposal} whatsapp={whatsapp} compact />
        </div>
      )}
      {m.contact && showContact && (
        <div className="w-full max-w-[94%]">
          <ContactCard prefill={m.contact} sent={leadSent} onSubmit={onSubmitContact} />
        </div>
      )}
      {m.handoff && <p className="text-xs text-white/50">El equipo de Novalius ha recibido un aviso.</p>}
      {isLast && !busy && m.quickReplies && m.quickReplies.length > 0 && (
        <div className="flex max-w-full flex-wrap gap-1.5">
          {m.quickReplies.map((o) => (
            <button
              key={o}
              onClick={() => onQuick(o, m.multi)}
              aria-pressed={m.multi ? selected.includes(o) : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                m.multi && selected.includes(o) ? "border-lavender bg-lavender text-ink" : "border-white/15 text-white/85 hover:border-lavender hover:bg-white/5",
              )}
            >
              {o}
            </button>
          ))}
          {m.multi && (
            <button onClick={onConfirmMulti} className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white">
              Continuar{selected.length ? ` (${selected.length})` : ""}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
