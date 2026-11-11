// Servidor de la API para desarrollo aislado (sin Vite): npx tsx --env-file=.env.local scripts/dev-api.ts
import { serve } from "@hono/node-server";
import { app } from "../server/app.js";
const port = Number(process.env.API_PORT || 8787);
serve({ fetch: app.fetch, port }, (i) => console.log(`API en http://localhost:${i.port}/api`));
