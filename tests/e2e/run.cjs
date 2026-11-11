// Pruebas de extremo a extremo con un navegador real (Playwright).
//
//   BASE=http://localhost:4173 MAILPIT=http://127.0.0.1:54324 node tests/e2e/run.cjs
//
// Requiere: la web en marcha (npm run preview), Supabase local con Mailpit y un
// administrador (ADMIN_EMAIL / ADMIN_PASSWORD). Crea usuarios y datos de prueba:
// NO ejecutar contra producción.
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE || "http://localhost:4173";
const MAILPIT = process.env.MAILPIT || "http://127.0.0.1:54324";
const ADMIN = { email: process.env.ADMIN_EMAIL || "", password: process.env.ADMIN_PASSWORD || "" };
if (!ADMIN.email || !ADMIN.password) {
  console.error("Faltan ADMIN_EMAIL y ADMIN_PASSWORD (un administrador de la base LOCAL, creado con npm run admin:create).");
  process.exit(1);
}
const OUT = process.env.OUT || "test-results";
const run = Date.now().toString(36);
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? "✔" : "✘"} ${name}${!ok && detail ? ` → ${String(detail).slice(0, 300)}` : ""}`);
}

async function mailFor(email, subjectMatch, tries = 20) {
  for (let i = 0; i < tries; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json();
    const msg = (list.messages || []).find((m) => subjectMatch.test(m.Subject));
    if (msg) {
      const full = await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json();
      return full.HTML || full.Text;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  return null;
}

function tokenLink(html) {
  const m = /href="[^"]*\/auth\/confirmar\?token_hash=([^"&]+)&(?:amp;)?type=([a-z_]+)"/.exec(html || "");
  return m ? `/auth/confirmar?token_hash=${m[1]}&type=${m[2]}` : null;
}

async function newContext(browser, mobile = false) {
  const ctx = await browser.newContext(mobile ? { ...devices["iPhone 13"] } : { viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      sessionStorage.setItem("nv-intro", "1");
      localStorage.setItem("nv-consent", JSON.stringify({ analytics: true, version: "2026-11", at: new Date().toISOString() }));
    } catch {}
  });
  return ctx;
}

function watch(page) {
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill("input[type=email]", email);
  await page.fill("input[type=password]", password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => new URL(u).pathname !== "/login", { timeout: 15000 });
}

const ROUTES = ["/", "/servicios", "/servicios/diseno-web", "/servicios/automatizaciones-ia", "/proyectos", "/proyectos/plataforma-novalius", "/plantillas", "/plantillas/restaurante", "/demo/clinica", "/nosotros", "/contacto", "/challenge", "/login", "/registro", "/recuperar", "/privacidad", "/cookies", "/terminos", "/ruta-inexistente"];

(async () => {
  const fs = require("node:fs");
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  // ---------------------------------------------------------------------------
  console.log("\n1. Rutas públicas (escritorio y móvil)");
  for (const mobile of [false, true]) {
    const ctx = await newContext(browser, mobile);
    const page = await ctx.newPage();
    const errors = watch(page);
    for (const path of ROUTES) {
      errors.length = 0;
      const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.trim() || "",
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        title: document.title,
        imgsNoAlt: [...document.images].filter((i) => !i.hasAttribute("alt")).length,
        unnamedButtons: [...document.querySelectorAll("button")].filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title")).length,
      }));
      const label = `${mobile ? "móvil" : "escritorio"} ${path}`;
      check(`${label}: carga sin errores`, res.status() === 200 && errors.length === 0, `${res.status()} ${errors.join(" | ")}`);
      check(`${label}: tiene h1 y título`, Boolean(info.h1) && Boolean(info.title), JSON.stringify(info));
      check(`${label}: sin desbordamiento horizontal`, info.overflow <= 1, `+${info.overflow}px`);
      check(`${label}: imágenes con alt y botones con nombre`, info.imgsNoAlt === 0 && info.unnamedButtons === 0, JSON.stringify(info));
      if (path === "/ruta-inexistente") check(`${label}: muestra 404`, /404|no existe/i.test(await page.textContent("body")));
    }
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.screenshot({ path: `${OUT}/${mobile ? "mobile" : "desktop"}-home.png` });
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n2. SEO técnico");
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();
  check("robots.txt bloquea /admin y /cuenta", /Disallow: \/admin/.test(robots) && /Disallow: \/cuenta/.test(robots));
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  check("sitemap dinámico con servicios y páginas", sitemap.includes("<urlset") && sitemap.includes("/servicios/diseno-web") && sitemap.includes("/nosotros"));
  const head = await fetch(`${BASE}/`);
  check("cabeceras de seguridad (CSP, nosniff, frame)", Boolean(head.headers.get("content-security-policy")) && head.headers.get("x-content-type-options") === "nosniff");

  // ---------------------------------------------------------------------------
  console.log("\n3. Registro con verificación de correo");
  const email = `e2e-${run}@test.novalius.local`;
  const password = `E2e-${run}-pass9`;
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(`${BASE}/registro`, { waitUntil: "networkidle" });
    await page.getByLabel(/^Nombre\*?$/).fill("Prueba E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.locator("label:has-text('Acepto los') input[type=checkbox]").check();
    await page.click("button[type=submit]");
    await page.waitForSelector("text=Revisa tu correo", { timeout: 10000 });
    check("formulario de registro enviado", true);
    const html = await mailFor(email, /Confirma tu correo/);
    const link = tokenLink(html);
    check("correo de verificación recibido con enlace", Boolean(link));
    await page.goto(BASE + link, { waitUntil: "networkidle" });
    await page.waitForURL((u) => new URL(u).pathname === "/cuenta", { timeout: 15000 });
    const verified = await page.waitForSelector("text=Correo verificado", { timeout: 10000 }).then(() => true).catch(() => false);
    check("verificación completada y sesión iniciada", verified);
    check("sin errores en el registro", errors.length === 0, errors.join(" | "));

    // Challenge: tres en raya por la interfaz
    await page.goto(`${BASE}/challenge`, { waitUntil: "networkidle" });
    await page.click("text=Tres en raya contra Nova");
    await page.click("text=Empezar partida");
    await page.waitForSelector("[role=grid]");
    for (let i = 0; i < 6; i++) {
      const free = page.locator("[role=gridcell]:not([disabled])");
      if ((await free.count()) === 0) break;
      const status = await page.textContent("[aria-live=polite]");
      if (/Has ganado|gana esta vez|Empate/.test(status || "")) break;
      await free.first().click();
      await page.waitForTimeout(900);
    }
    const final = await page.textContent("body");
    check("partida de tres en raya completada por la interfaz", /Has ganado|gana esta vez|Empate|Revancha/.test(final), final.slice(0, 200));

    // Quiz: empezar y responder una pregunta
    await page.click("text=Volver a los juegos");
    await page.click("text=Quiz relámpago");
    await page.click("text=Empezar");
    await page.waitForSelector("[role=progressbar][aria-label='Tiempo restante']", { timeout: 10000 });
    await page.waitForTimeout(300);
    const timer = await page.locator("[role=progressbar] + div").textContent();
    check("quiz iniciado con temporizador", /\d+\.\d\s*s/.test(timer || ""), timer);
    const option = page.locator(".grid.gap-3 button").first();
    await option.click();
    await page.waitForTimeout(400);
    check("respuesta corregida por el servidor", (await page.locator(".border-success, .border-danger").count()) > 0);
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n4. Recuperación de contraseña");
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/recuperar`, { waitUntil: "networkidle" });
    await page.fill("input[type=email]", email);
    await page.click("button[type=submit]");
    await page.waitForSelector("text=recibirás un correo");
    const html = await mailFor(email, /Restablece/);
    const link = tokenLink(html);
    check("correo de recuperación recibido", Boolean(link));
    await page.goto(BASE + link, { waitUntil: "networkidle" });
    await page.waitForURL((u) => new URL(u).pathname === "/restablecer", { timeout: 15000 });
    const newPass = `${password}-nuevo1`;
    await page.getByLabel("Nueva contraseña").fill(newPass);
    await page.getByLabel("Repite la contraseña").fill(newPass);
    await page.click("button[type=submit]");
    await page.waitForURL((u) => new URL(u).pathname === "/cuenta", { timeout: 15000 });
    await ctx.clearCookies();
    await page.evaluate(() => localStorage.removeItem("nv-auth"));
    await login(page, email, newPass);
    check("inicio de sesión con la nueva contraseña", new URL(page.url()).pathname === "/cuenta");
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n5. Nova (modo guiado) y lead con consentimiento");
  const leadName = `Lead E2E ${run}`;
  {
    const ctx = await newContext(browser, true);
    const page = await ctx.newPage();
    const errors = watch(page);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.click("button[aria-label='Hablar con Nova']");
    await page.waitForSelector("[role=dialog][aria-label^='Nova']");
    const answers = ["Landing page", "Restauración", "Conseguir más clientes", "No, todavía no", "__multi", "Partir de una plantilla", "No", "Ninguna", "Ninguna", "Sin prisa", "Prefiero no decirlo"];
    for (const a of answers) {
      if (a === "__multi") {
        await page.click("button:has-text('Reservas o citas online')");
        await page.click("button:has-text('Continuar')");
      } else {
        await page.click(`[role=dialog] button:has-text("${a}")`, { timeout: 10000 });
      }
      await page.waitForTimeout(500);
    }
    await page.waitForSelector("text=Estimación orientativa", { timeout: 10000 });
    check("Nova muestra la tarjeta de presupuesto", true);
    await page.click("[role=dialog] button:has-text('Sí, quiero una propuesta')");
    await page.waitForSelector("text=Enviar al equipo de Novalius", { timeout: 10000 });
    await page.fill("[aria-label='Nombre']", leadName);
    await page.fill("[aria-label='Correo electrónico']", `lead-${run}@example.com`);
    await page.click("[role=dialog] button:has-text('Enviar al equipo')");
    check("sin consentimiento no se envía", await page.isVisible("text=Debes aceptar la política de privacidad"));
    await page.locator("[role=dialog] label:has-text('política de privacidad') input").check();
    await page.click("[role=dialog] button:has-text('Enviar al equipo')");
    await page.waitForSelector("text=Solicitud enviada", { timeout: 10000 });
    check("lead enviado desde Nova", true);
    check("sin errores en Nova", errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: `${OUT}/mobile-nova.png` });
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n6. Formulario de contacto");
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/contacto?plantilla=barberia`, { waitUntil: "networkidle" });
    await page.getByLabel(/^Nombre\*?$/).fill(`Formulario ${run}`);
    await page.getByLabel("Correo electrónico").fill(`form-${run}@example.com`);
    await page.waitForTimeout(1600);
    await page.locator("label:has-text('política de privacidad') input").check();
    await page.click("button:has-text('Enviar solicitud')");
    await page.waitForSelector("text=Solicitud recibida", { timeout: 10000 });
    check("formulario de contacto enviado (con plantilla de referencia)", true);
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n7. Panel: CRM, editor visual con publicación y diseño global");
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    const errors = watch(page);
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto(`${BASE}/admin/crm`, { waitUntil: "networkidle" });
    await page.fill("input[placeholder^='Buscar por nombre']", leadName);
    await page.click(`text=${leadName}`);
    await page.waitForURL(/\/admin\/crm\/.+/);
    await page.waitForSelector("text=Estado comercial");
    const hasQuote = await page.waitForSelector("text=Estimación orientativa", { timeout: 8000 }).then(() => true).catch(() => false);
    check("el lead de Nova aparece en el CRM con su presupuesto", hasQuote);
    await page.getByLabel("Estado", { exact: true }).selectOption("contacted");
    const logged = await page.waitForSelector("text=Estado: Nuevo → Contactado", { timeout: 8000 }).then(() => true).catch(() => false);
    check("cambio de estado registrado en el historial", logged);

    // Editor visual: cambiar el titular, guardar, publicar y comprobar la web
    await page.goto(`${BASE}/admin/paginas`, { waitUntil: "networkidle" });
    await page.click("text=Nosotros");
    await page.waitForSelector("text=Estructura");
    await page.click("aside[aria-label=Estructura] >> text=Cabecera");
    const newTitle = `Equipo Novalius ${run}`;
    const titleField = page.getByLabel("Título", { exact: true });
    await titleField.fill(newTitle);
    await page.click("button:has-text('Guardar')");
    await page.waitForSelector("text=Borrador guardado");
    const publicBefore = await (await browser.newPage()).goto(`${BASE}/nosotros`);
    void publicBefore;
    await page.click("header button:has-text('Publicar')");
    await page.click("[role=dialog] button:has-text('Publicar')");
    await page.waitForSelector("text=Página publicada");
    const pub = await browser.newPage();
    await pub.goto(`${BASE}/nosotros`, { waitUntil: "networkidle" });
    await pub.waitForTimeout(800);
    check("el cambio publicado se ve en la web", (await pub.textContent("h1")).includes(newTitle));
    // Restaurar la versión anterior y volver a publicar
    await page.click("button:has-text('Versiones')");
    await page.locator("li:has-text('Versión') >> button:has-text('Restaurar')").nth(1).click();
    await page.locator("[role=dialog] button:has-text('Restaurar')").last().click();
    await page.waitForTimeout(1200);
    await page.click("header button:has-text('Publicar')");
    await page.click("[role=dialog] button:has-text('Publicar')");
    await page.waitForSelector("text=Página publicada");
    await pub.reload({ waitUntil: "networkidle" });
    await pub.waitForTimeout(800);
    check("restaurar versión y republicar revierte el cambio", !(await pub.textContent("h1")).includes(newTitle));

    // Diseño global: cambiar el color principal y publicar
    await page.goto(`${BASE}/admin/diseno`, { waitUntil: "networkidle" });
    await page.locator("input[aria-label='Morado principal']").evaluate((el) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, "#7a1fe0");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("button:has-text('Guardar borrador')");
    await page.waitForSelector("text=Borrador de diseño guardado");
    await page.click("button:has-text('Publicar') >> nth=0");
    await page.click("[role=dialog] button:has-text('Publicar')");
    await page.waitForSelector("text=Diseño publicado");
    const pub2 = await browser.newPage();
    await pub2.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await pub2.waitForTimeout(1000);
    const primary = await pub2.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--nv-primary").trim());
    check("el diseño publicado se aplica a la web", primary.toLowerCase() === "#7a1fe0", primary);
    // Volver al diseño original
    await page.locator("input[aria-label='Morado principal']").evaluate((el) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, "#6c26e8");
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.click("button:has-text('Guardar borrador')");
    await page.waitForSelector("text=Borrador de diseño guardado");
    await page.click("button:has-text('Publicar') >> nth=0");
    await page.click("[role=dialog] button:has-text('Publicar')");
    await page.waitForSelector("text=Diseño publicado");
    check("sin errores en el panel", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  // ---------------------------------------------------------------------------
  console.log("\n8. Acceso al panel sin permisos");
  {
    const ctx = await newContext(browser);
    const page = await ctx.newPage();
    await login(page, email, `${password}-nuevo1`);
    await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
    check("un usuario normal no accede al panel", (await page.textContent("body")).includes("Acceso restringido"));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  fs.writeFileSync(`${OUT}/e2e-report.json`, JSON.stringify({ run, base: BASE, total: results.length, failed: failed.length, results }, null, 2));
  console.log(`\nResultado: ${results.length - failed.length} correctas, ${failed.length} fallidas\n`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
