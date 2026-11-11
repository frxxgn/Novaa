import { randomInt } from "node:crypto";
import { admin, getSetting } from "../lib/supabase.js";
import { notifyTeam } from "../notify/index.js";
import { CHALLENGE_DEFAULTS } from "./settings.js";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateCouponCode(): string {
  const block = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `NOVA-${block()}-${block()}`;
}

export interface IssuedCoupon {
  code: string;
  percent: number;
  expires_at: string;
  conditions: string;
  already: boolean;
}

/** Emite el cupón del reto (uno por cuenta, garantizado también por índice único). */
export async function issueChallengeCoupon(userId: string, sessionId: string, game: string): Promise<IssuedCoupon> {
  const db = admin();
  const cfg = await getSetting("challenge", CHALLENGE_DEFAULTS);
  const { data: existing } = await db.from("coupons").select("code, percent, expires_at, conditions").eq("user_id", userId).eq("source", "challenge").maybeSingle();
  if (existing) return { ...existing, percent: Number(existing.percent), already: true };

  const expires = new Date(Date.now() + (Number(cfg.coupon_valid_days) || 90) * 86_400_000).toISOString();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCouponCode();
    const { data, error } = await db
      .from("coupons")
      .insert({
        code,
        user_id: userId,
        percent: Number(cfg.coupon_percent) || 5,
        source: "challenge",
        source_session_id: sessionId,
        expires_at: expires,
        conditions: String(cfg.coupon_conditions ?? ""),
      })
      .select("id, code, percent, expires_at, conditions")
      .single();
    if (!error && data) {
      await db.from("game_sessions").update({ coupon_id: data.id }).eq("id", sessionId);
      const { data: profile } = await db.from("profiles").select("email").eq("id", userId).maybeSingle();
      void notifyTeam({
        event: "coupon_won",
        title: "Nuevo cupón del Challenge",
        body: `${profile?.email ?? "Un usuario"} ha ganado un cupón del ${data.percent} % jugando a ${game === "quiz" ? "Quiz" : "Tres en raya"}. Código: ${data.code}.`,
        link: "/admin/challenge",
        entity: "coupons",
        entityId: data.id,
      });
      return { code: data.code, percent: Number(data.percent), expires_at: data.expires_at, conditions: data.conditions, already: false };
    }
    // 23505 = único violado: o colisión de código o ya existe cupón de reto
    if (error?.code === "23505") {
      const { data: again } = await db.from("coupons").select("code, percent, expires_at, conditions").eq("user_id", userId).eq("source", "challenge").maybeSingle();
      if (again) return { ...again, percent: Number(again.percent), already: true };
      continue;
    }
    throw error;
  }
  throw new Error("No se pudo generar un código único");
}
