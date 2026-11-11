// Punto de entrada de Vercel: una única función para toda la API (/api/*).
// vercel.json reescribe /api/(.*), /sitemap.xml y /robots.txt hacia esta función; Vercel
// conserva la URL original de la petición, que Hono enruta.
import { handle } from "hono/vercel";
import { app } from "../server/app.js";

export const config = { maxDuration: 60 };

const hono = handle(app);

const handler = (request: Request) => {
  const url = new URL(request.url);
  const alias = url.pathname === "/sitemap.xml" ? "/api/sitemap" : url.pathname === "/robots.txt" ? "/api/robots" : null;
  if (alias) {
    url.pathname = alias;
    return hono(new Request(url, request));
  }
  return hono(request);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
