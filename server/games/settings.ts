export interface ChallengeSettings extends Record<string, unknown> {
  enabled: boolean;
  quiz_questions: number;
  quiz_duration_seconds: number;
  quiz_grace_ms: number;
  quiz_min_answer_ms: number;
  quiz_attempts_per_day: number;
  quiz_mix: Record<string, number>;
  ttt_attempts_per_day: number;
  ttt_levels: Record<string, { label: string; mistake_rate: number }>;
  ttt_reward_levels: string[];
  coupon_percent: number;
  coupon_valid_days: number;
  coupon_conditions: string;
}

export const CHALLENGE_DEFAULTS: ChallengeSettings = {
  enabled: true,
  quiz_questions: 10,
  quiz_duration_seconds: 60,
  quiz_grace_ms: 1500,
  quiz_min_answer_ms: 350,
  quiz_attempts_per_day: 5,
  quiz_mix: { "1": 4, "2": 4, "3": 2 },
  ttt_attempts_per_day: 15,
  ttt_levels: {
    facil: { label: "Fácil", mistake_rate: 0.6 },
    normal: { label: "Normal", mistake_rate: 0.3 },
    experto: { label: "Experto", mistake_rate: 0.1 },
  },
  ttt_reward_levels: ["normal", "experto"],
  coupon_percent: 5,
  coupon_valid_days: 90,
  coupon_conditions: "",
};
