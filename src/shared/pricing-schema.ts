// Validación (zod) de los requisitos de presupuesto. Solo la usa el servidor y
// las pruebas: el navegador no necesita cargar zod.
import { z } from "zod";
import { COMPLEXITY_LEVELS, DESIGN_LEVELS, FEATURE_KEYS, MAINTENANCE_PLANS, PROJECT_TYPES, TIMELINES, type QuoteRequirements } from "./pricing.js";

export const quoteRequirementsSchema = z.object({
  project_type: z.enum(PROJECT_TYPES),
  title: z.string().trim().max(140).optional(),
  business: z.string().trim().max(200).optional(),
  pages: z.number().int().min(0).max(200).optional(),
  design: z.enum(DESIGN_LEVELS).default("custom"),
  features: z.array(z.enum(FEATURE_KEYS)).max(FEATURE_KEYS.length).default([]),
  quantities: z
    .object({
      multilingual: z.number().int().min(0).max(20).optional(),
      integration: z.number().int().min(0).max(30).optional(),
      automation: z.number().int().min(0).max(50).optional(),
      copywriting: z.number().int().min(0).max(200).optional(),
    })
    .default({}),
  complexity: z.enum(COMPLEXITY_LEVELS).default("medium"),
  timeline: z.enum(TIMELINES).default("standard"),
  maintenance: z.enum(MAINTENANCE_PLANS).default("none"),
  notes: z.string().trim().max(1200).optional(),
});

// Comprobación en tiempo de compilación: el esquema produce el tipo compartido
export type _SchemaMatches = z.infer<typeof quoteRequirementsSchema> extends QuoteRequirements ? true : never;
