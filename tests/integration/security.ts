// Pruebas de integración y seguridad contra un Supabase real (local o de
// staging) y la API en marcha. NO ejecutar contra producción: crea usuarios.
//
//   npx tsx --env-file=.env.local tests/integration/security.ts
//
// Requiere: SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY y
// API_URL (por defecto http://localhost:8787).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const PUBLISHABLE = process.env.SUPABASE_PUBLISHABLE_KEY!;
const API = process.env.API_URL || "http://localhost:8787";
if (!SUPABASE_URL || !SECRET || !PUBLISHABLE) throw new Error("Faltan variables de Supabase");
if (/supabase\.co/.test(SUPABASE_URL) && !process.env.ALLOW_REMOTE_TESTS) throw new Error("Por seguridad, no se ejecuta contra un proyecto remoto sin ALLOW_REMOTE_TESTS=1");

const service = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false } });
const run = Date.now().toString(36);
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.log(`  ✘ ${name}${detail ? ` → ${detail}` : ""}`);
  }
}

async function makeUser(label: string, opts: { confirmed?: boolean; role?: "customer" | "team" | "admin" } = {}) {
  const email = `${label}-${run}@test.novalius.local`;
  const password = `Pw-${run}-${label}-9x`;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: opts.confirmed !== false, user_metadata: { full_name: label } });
  if (error || !data.user) throw error;
  if (opts.role) await service.from("user_roles").insert({ user_id: data.user.id, role: opts.role });
  const client = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  if (opts.confirmed !== false) {
    const { error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr) throw signErr;
  }
  const { data: session } = await client.auth.getSession();
  return { id: data.user.id, email, password, client, token: session.session?.access_token ?? "" };
}

async function api(path: string, token: string | null, body?: unknown, method = body ? "POST" : "GET") {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

async function rows(client: SupabaseClient, table: string) {
  const { data, error } = await client.from(table).select("*").limit(50);
  return { data: data ?? [], error };
}

async function main() {
  console.log(`\nNovalius · pruebas de seguridad e integración (${run})\n`);
  const anon = createClient(SUPABASE_URL, PUBLISHABLE, { auth: { persistSession: false } });
  const adminU = await makeUser("admin", { role: "admin" });
  const team = await makeUser("team", { role: "team" });
  const userA = await makeUser("usera");
  const userB = await makeUser("userb");
  const custA = await makeUser("custa", { role: "customer" });
  const unverified = await makeUser("unverified", { confirmed: false });

  // ---------------------------------------------------------------------
  console.log("Lectura pública y datos privados (anónimo)");
  check("anon lee servicios publicados", (await rows(anon, "services")).data.length >= 11);
  check("anon lee páginas publicadas", (await anon.rpc("get_published_page", { p_path: "/" })).data !== null);
  for (const t of ["leads", "conversations", "messages", "pricing_rules", "chatbot_settings", "chatbot_knowledge", "game_questions", "quotes", "coupons", "customers", "audit_logs", "profiles", "page_sections", "notification_deliveries", "analytics_events", "rate_limits"]) {
    const { data, error } = await rows(anon, t);
    check(`anon no lee ${t}`, data.length === 0, error ? "" : `${data.length} filas`);
  }
  const { data: privSettings } = await anon.from("site_settings").select("key").in("key", ["notifications", "security", "pricing"]);
  check("anon no lee ajustes privados", (privSettings ?? []).length === 0);
  const novaPublic = await anon.rpc("get_public_nova_config");
  check("config pública de Nova no expone instrucciones", novaPublic.data && !("instructions" in (novaPublic.data as object)));
  const { error: anonInsert } = await anon.from("leads").insert({ name: "x", email: "x@x.es" });
  check("anon no inserta leads directamente", Boolean(anonInsert));

  // ---------------------------------------------------------------------
  console.log("\nEscalada de privilegios");
  const { error: selfRole } = await userA.client.from("user_roles").insert({ user_id: userA.id, role: "admin" });
  check("un usuario no puede asignarse rol admin", Boolean(selfRole));
  const { error: teamAdmin } = await team.client.from("user_roles").insert({ user_id: userB.id, role: "admin" });
  check("el equipo no puede conceder admin", Boolean(teamAdmin));
  const { error: disableSelf } = await userA.client.from("profiles").update({ is_disabled: true } as never).eq("id", userA.id);
  check("un usuario no puede tocar columnas protegidas del perfil", Boolean(disableSelf));
  const { data: ownUpdate, error: ownUpdateErr } = await userA.client.from("profiles").update({ full_name: "Usuaria A" }).eq("id", userA.id).select("full_name");
  check("un usuario sí actualiza su nombre", !ownUpdateErr && ownUpdate?.[0]?.full_name === "Usuaria A");
  const { data: otherProfile } = await userA.client.from("profiles").select("id").eq("id", userB.id);
  check("un usuario no ve el perfil de otro", (otherProfile ?? []).length === 0);
  const { error: couponForge } = await userA.client.from("coupons").insert({ code: "NOVA-FAKE-0000", user_id: userA.id, percent: 50, expires_at: new Date().toISOString() });
  check("un usuario no puede crear cupones", Boolean(couponForge));
  const { error: pricingTeam } = await team.client.from("pricing_rules").update({ min_amount: 1 }).eq("key", "base_web");
  const { data: pricingTeamRead } = await team.client.from("pricing_rules").select("key");
  check("el equipo no lee ni edita tarifas", (pricingTeamRead ?? []).length === 0 && !pricingTeam);
  const { data: pageRow } = await service.from("pages").select("id").eq("path", "/nosotros").single();
  const teamPublish = await team.client.rpc("publish_page", { p_page_id: pageRow!.id, p_note: "x" });
  check("el equipo no puede publicar páginas (sin content.publish)", Boolean(teamPublish.error));
  const adminPublish = await adminU.client.rpc("publish_page", { p_page_id: pageRow!.id, p_note: "prueba" });
  check("el administrador publica páginas", !adminPublish.error);
  const { error: lastAdmin } = await adminU.client.from("user_roles").delete().eq("user_id", adminU.id).eq("role", "admin");
  check("nadie puede retirarse su propio rol", Boolean(lastAdmin));
  const access = await team.client.rpc("my_access");
  check("my_access devuelve permisos del equipo", (access.data as any)?.permissions?.includes("crm.read") && !(access.data as any)?.permissions?.includes("pricing.manage"));

  // ---------------------------------------------------------------------
  console.log("\nAPI: autenticación, presupuestos y leads");
  check("health responde", (await api("/health", null)).status === 200);
  const forged = await api("/games/status", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.invalid");
  check("token falso rechazado", forged.status === 401);
  const anonGame = await api("/games/quiz/start", null, {});
  check("anon no puede jugar", anonGame.status === 401);
  const unv = await api("/games/quiz/start", unverified.token || null, {});
  check("usuario sin verificar no puede jugar", unv.status === 401 || unv.status === 403);

  const est = await api("/quotes/estimate", null, { project_type: "landing", features: ["seo_setup"] });
  check("presupuesto anónimo calculado en servidor", est.status === 200 && est.json.quote.total_min > 0 && Boolean(est.json.quote.claim_token));
  const forgedQuote = await api("/quotes/estimate", null, { project_type: "landing", features: [], total_min: 1 });
  check("el cliente no puede fijar importes", forgedQuote.status === 200 && forgedQuote.json.quote.total_min !== 1);
  const badClaim = await api(`/quotes/${est.json.quote.id}/claim`, userB.token, { token: "x".repeat(20) });
  check("no se puede reclamar un presupuesto con token falso", badClaim.status === 403);
  const claim = await api(`/quotes/${est.json.quote.id}/claim`, userA.token, { token: est.json.quote.claim_token });
  check("el usuario reclama su presupuesto con el token", claim.status === 200);
  const { data: aQuotes } = await userA.client.from("quotes").select("id");
  const { data: bQuotes } = await userB.client.from("quotes").select("id");
  check("RLS: A ve su presupuesto y B no", (aQuotes ?? []).length === 1 && (bQuotes ?? []).length === 0);
  const noConsent = await api("/leads", null, { name: "Sin", email: "sin@example.com", message: "hola", consent: false });
  check("lead sin consentimiento rechazado", noConsent.status === 422);
  const lead = await api("/leads", null, { name: "Formulario", email: `form-${run}@example.com`, message: "Quiero una web", consent: true, started_at: Date.now() - 10_000 });
  check("lead del formulario creado", lead.status === 200 && Boolean(lead.json.lead_id));
  const { data: teamLeads } = await team.client.from("leads").select("id");
  const { data: userLeads } = await userA.client.from("leads").select("id");
  check("RLS: el equipo ve leads y un usuario no", (teamLeads ?? []).length > 0 && (userLeads ?? []).length === 0);
  const { error: teamDeleteLead } = await team.client.from("leads").delete().eq("id", lead.json.lead_id);
  const { data: stillThere } = await service.from("leads").select("id").eq("id", lead.json.lead_id);
  check("el equipo no puede borrar leads", !teamDeleteLead && (stillThere ?? []).length === 1);
  const exportTeam = await api("/admin/leads/export", team.token);
  check("exportar CRM requiere crm.export", exportTeam.status === 403);
  const exportAdmin = await api("/admin/leads/export", adminU.token);
  check("el admin exporta CSV", exportAdmin.status === 200 && String(exportAdmin.json).includes("Correo"));

  // ---------------------------------------------------------------------
  console.log("\nNovalius Challenge: quiz validado en servidor y cupón único");
  const start = await api("/games/quiz/start", userA.token, {});
  check("quiz iniciado con hora del servidor", start.status === 200 && Boolean(start.json.deadline_at));
  check("la pregunta no incluye la respuesta", start.status === 200 && !JSON.stringify(start.json.question).includes("correct"));
  let q = start.json.question;
  let result: any = null;
  const sessionId = start.json.session_id;
  const { data: sess } = await service.from("game_sessions").select("state").eq("id", sessionId).single();
  const state = sess!.state as { questions: { correct: number }[] };
  for (let i = 0; i < state.questions.length; i++) {
    await new Promise((r) => setTimeout(r, 420));
    const r = await api("/games/quiz/answer", userA.token, { session_id: sessionId, position: q.position, choice: state.questions[i]!.correct });
    if (r.json.finished) {
      result = r.json.result;
      break;
    }
    q = r.json.question;
  }
  check("10/10 dentro de tiempo → victoria", result?.status === "won" && result?.score === 10, JSON.stringify(result));
  check("cupón generado por el servidor", /^NOVA-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(result?.coupon?.code ?? ""));
  const dup = await api("/games/quiz/answer", userA.token, { session_id: sessionId, position: 9, choice: 0 });
  check("no se puede responder una partida cerrada", dup.status === 410);
  const { data: couponsA } = await userA.client.from("coupons").select("code, status");
  const { data: couponsB } = await userB.client.from("coupons").select("code");
  check("RLS: A ve su cupón, B no", (couponsA ?? []).length === 1 && (couponsB ?? []).length === 0);

  // Segunda victoria: no genera otro cupón
  const s2 = await api("/games/ttt/start", userA.token, { level: "facil" });
  check("tres en raya iniciado", s2.status === 200);
  const occupied = await api("/games/ttt/move", userA.token, { session_id: s2.json.session_id, cell: 4 });
  const occ2 = await api("/games/ttt/move", userA.token, { session_id: s2.json.session_id, cell: occupied.json.nova_move ?? 4 });
  check("casilla ocupada rechazada", occ2.status === 409);
  const { count: couponCount } = await service.from("coupons").select("id", { count: "exact", head: true }).eq("user_id", userA.id);
  check("un único cupón por cuenta", couponCount === 1);

  // Timeout: partida con plazo vencido no puede ganar
  const s3 = await api("/games/quiz/start", userB.token, {});
  await service.from("game_sessions").update({ deadline_at: new Date(Date.now() - 5000).toISOString() }).eq("id", s3.json.session_id);
  const late = await api("/games/quiz/answer", userB.token, { session_id: s3.json.session_id, position: 0, choice: 0 });
  check("respuesta fuera de plazo → partida terminada sin premio", late.json.timeout === true && late.json.result.status !== "won");
  const other = await api("/games/quiz/answer", userA.token, { session_id: s3.json.session_id, position: 0, choice: 0 });
  check("no se puede jugar la partida de otro usuario", other.status === 403 || other.status === 410);

  // Canje: equipo con coupons.manage; doble canje imposible
  const code = result?.coupon?.code;
  const r1 = await team.client.rpc("redeem_coupon", { p_code: code, p_quote_id: null, p_project_id: null, p_amount: 100, p_notes: "prueba" });
  const r2 = await team.client.rpc("redeem_coupon", { p_code: code, p_quote_id: null, p_project_id: null, p_amount: 100, p_notes: "prueba" });
  check("canje del cupón por el equipo", (r1.data as any)?.ok === true);
  check("el cupón no es reutilizable", (r2.data as any)?.ok === false && (r2.data as any)?.reason === "used");
  const r3 = await userB.client.rpc("redeem_coupon", { p_code: code, p_quote_id: null, p_project_id: null, p_amount: 100, p_notes: "" });
  check("un usuario no puede canjear cupones", Boolean(r3.error));

  // ---------------------------------------------------------------------
  console.log("\nPortal de clientes: aislamiento");
  const { data: customer } = await service.from("customers").insert({ user_id: custA.id, name: "Cliente A", email: custA.email }).select("id").single();
  const { data: project } = await service.from("customer_projects").insert({ customer_id: customer!.id, name: "Web Cliente A", status: "in_progress" }).select("id").single();
  await service.from("project_tasks").insert([
    { project_id: project!.id, title: "Tarea visible", visible_to_client: true },
    { project_id: project!.id, title: "Tarea interna", visible_to_client: false },
  ]);
  const { data: hidden } = await service.from("customer_projects").insert({ customer_id: customer!.id, name: "Proyecto oculto", visible_to_client: false }).select("id").single();
  const { data: custProjects } = await custA.client.from("customer_projects").select("id, name");
  check("el cliente ve solo sus proyectos visibles", (custProjects ?? []).length === 1 && custProjects![0]!.id === project!.id);
  const { data: custTasks } = await custA.client.from("project_tasks").select("title");
  check("el cliente no ve tareas internas", (custTasks ?? []).length === 1 && custTasks![0]!.title === "Tarea visible");
  const { data: bProjects } = await userB.client.from("customer_projects").select("id");
  check("otro usuario no ve proyectos ajenos", (bProjects ?? []).length === 0);
  const { error: custWrite } = await custA.client.from("customer_projects").update({ progress: 100 }).eq("id", project!.id);
  const { data: progress } = await service.from("customer_projects").select("progress").eq("id", project!.id).single();
  check("el cliente no puede modificar su proyecto", !custWrite && progress!.progress === 0);
  void hidden;

  // Archivos privados
  const path = `${project!.id}/informe-${run}.txt`;
  const up = await adminU.client.storage.from("project-files").upload(path, new Blob(["contenido privado"], { type: "text/plain" }));
  check("el admin sube un archivo privado", !up.error, up.error?.message);
  await service.from("project_files").insert({ project_id: project!.id, storage_path: path, file_name: "informe.txt", mime_type: "text/plain", size_bytes: 17 });
  const dlA = await custA.client.storage.from("project-files").download(path);
  check("el cliente descarga su archivo", !dlA.error && (await dlA.data!.text()) === "contenido privado");
  const dlB = await userB.client.storage.from("project-files").download(path);
  check("otro usuario no descarga el archivo", Boolean(dlB.error));
  const dlAnon = await anon.storage.from("project-files").download(path);
  check("anónimo no descarga el archivo", Boolean(dlAnon.error));
  const upUser = await userA.client.storage.from("media").upload(`hack-${run}.svg`, new Blob(["<svg/>"], { type: "image/svg+xml" }));
  check("un usuario no sube a la biblioteca de medios", Boolean(upUser.error));

  // ---------------------------------------------------------------------
  console.log("\nAuditoría");
  const { data: audits } = await adminU.client.from("audit_logs").select("action, entity").eq("entity", "user_roles").limit(5);
  check("los cambios de roles quedan auditados", (audits ?? []).length > 0);
  const { error: auditDelete } = await adminU.client.from("audit_logs").delete().eq("entity", "user_roles");
  const { count: auditCount } = await service.from("audit_logs").select("id", { count: "exact", head: true }).eq("entity", "user_roles");
  check("nadie puede borrar el registro de auditoría", (auditCount ?? 0) > 0, auditDelete?.message);
  const { data: teamAudit } = await team.client.from("audit_logs").select("id").limit(1);
  check("el equipo no lee auditoría (sin audit.read)", (teamAudit ?? []).length === 0);

  // Limpieza
  for (const u of [adminU, team, userA, userB, custA, unverified]) await service.auth.admin.deleteUser(u.id);
  await service.from("customers").delete().eq("id", customer!.id);
  await service.storage.from("project-files").remove([path]);

  console.log(`\nResultado: ${passed} correctas, ${failed} fallidas\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
