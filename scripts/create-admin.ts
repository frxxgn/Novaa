// Crea (o promueve) el primer administrador de Novalius.
//
//   npx tsx --env-file=.env.local scripts/create-admin.ts correo@empresa.com "Nombre" [contraseña]
//
// Si no se indica contraseña, se envía una invitación por correo para que la
// persona la cree. Requiere SUPABASE_URL y SUPABASE_SECRET_KEY (solo en tu equipo
// o en un entorno seguro: nunca en el navegador).
import { createClient } from "@supabase/supabase-js";

const [email, fullName = "", password] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('Uso: tsx scripts/create-admin.ts correo@empresa.com "Nombre" [contraseña]');
  process.exit(1);
}
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SECRET_KEY.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: existing } = await db.from("profiles").select("id").eq("email", email!.toLowerCase()).maybeSingle();
  let userId = existing?.id as string | undefined;
  if (!userId) {
    if (password) {
      if (password.length < 10) throw new Error("La contraseña debe tener al menos 10 caracteres.");
      const { data, error } = await db.auth.admin.createUser({ email: email!, password, email_confirm: true, user_metadata: { full_name: fullName } });
      if (error) throw error;
      userId = data.user.id;
      console.log(`Cuenta creada: ${email}`);
    } else {
      const site = process.env.SITE_URL || "http://localhost:5173";
      const { data, error } = await db.auth.admin.inviteUserByEmail(email!, { redirectTo: `${site}/auth/confirmar`, data: { full_name: fullName } });
      if (error) throw error;
      userId = data.user.id;
      console.log(`Invitación enviada a ${email}`);
    }
  }
  const { error } = await db.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
  if (error) throw error;
  console.log(`Rol de administrador asignado a ${email}. Accede en /admin`);
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
