import { useState } from "react";
import { motion } from "motion/react";
import { Check, Copy, Ticket } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface IssuedCoupon {
  code: string;
  percent: number;
  expires_at: string;
  conditions: string;
  already: boolean;
}

export function CouponReveal({ coupon }: { coupon: IssuedCoupon }) {
  const [copied, setCopied] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9, rotateX: 30 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} transition={{ type: "spring", damping: 16 }} className="relative mx-auto w-full max-w-md overflow-hidden rounded-lg bg-white p-6 text-ink shadow-[0_30px_80px_-20px_var(--nv-primary)]">
      <div className="absolute -left-4 top-1/2 size-8 -translate-y-1/2 rounded-full bg-[var(--nv-bg-dark)]" />
      <div className="absolute -right-4 top-1/2 size-8 -translate-y-1/2 rounded-full bg-[var(--nv-bg-dark)]" />
      <div className="flex items-center gap-2 text-primary">
        <Ticket className="size-5" />
        <p className="eyebrow">{coupon.already ? "Tu cupón (ya conseguido)" : "¡Cupón desbloqueado!"}</p>
      </div>
      <p className="mt-3 font-display text-5xl tracking-tighter">−{coupon.percent} %</p>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-sm border-2 border-dashed border-primary/40 px-4 py-3">
        <code className="font-mono text-lg tracking-widest">{coupon.code}</code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(coupon.code);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* portapapeles no disponible */
            }
          }}
          className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs text-white"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-3 text-xs text-ink/60">Caduca el {formatDate(coupon.expires_at)}. {coupon.conditions}</p>
      {coupon.already && <p className="mt-2 text-xs text-ink/60">Solo se concede un cupón por cuenta: este es el que ya tenías.</p>}
    </motion.div>
  );
}
