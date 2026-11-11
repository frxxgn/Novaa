// Punto de entrada de Vercel: una única función para toda la API (/api/*).
// vercel.json reescribe /api/(.*) hacia esta función conservando la ruta.
import { handle } from "hono/vercel";
import { app } from "../server/app.js";

export const config = { maxDuration: 60 };

const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
