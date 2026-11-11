# Despliegue: Supabase + Vercel + GitHub

Orden recomendado: **1) Supabase → 2) Vercel → 3) dominio → 4) primer administrador → 5) integraciones opcionales**.

> El despliegue en Vercel y Supabase en la nube **no se ha podido probar desde el entorno de desarrollo**
> (no hay credenciales de esas cuentas). Todo se ha verificado en local con Supabase CLI y con el servidor de
> producción (`server/node.ts`). Sigue la lista de comprobación del final tras el primer despliegue.

---

## 1. Supabase (base de datos, autenticación y archivos)

1. Crea un proyecto en [supabase.com](https://supabase.com) (región UE recomendada para el RGPD, p. ej. Frankfurt o París).
2. En tu equipo, desde la carpeta del repositorio:

   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push --include-seed     # migraciones + datos iniciales (solo la primera vez)
   ```

   - Las migraciones crean tablas, funciones, políticas RLS, roles, permisos y los buckets de Storage
     (`media` público y `project-files` privado).
   - Los *seeds* cargan el contenido inicial (páginas, servicios, plantillas, reglas de precios, preguntas del
     Challenge y configuración de Nova). **Ejecútalos una sola vez** sobre una base vacía.

3. **Authentication → URL Configuration**
   - *Site URL*: `https://tu-dominio` (mientras no haya dominio, la URL `*.vercel.app` del proyecto).
   - *Redirect URLs*: `https://tu-dominio/**` y, si usarás despliegues de vista previa, `https://*-<tu-equipo>.vercel.app/**`.
4. **Authentication → Providers → Email**
   - *Confirm email*: activado. *Secure email change*: activado.
   - *Minimum password length*: 10; *Password requirements*: letras y dígitos (igual que en local).
5. **Authentication → Email Templates**: pega el contenido de cada archivo de `supabase/templates/`:

   | Plantilla en Supabase | Archivo | Asunto sugerido |
   | --- | --- | --- |
   | Confirm signup | `confirmation.html` | Confirma tu cuenta de Novalius |
   | Invite user | `invite.html` | Te han invitado a Novalius |
   | Magic Link | `magic_link.html` | Tu enlace de acceso a Novalius |
   | Change Email Address | `email_change.html` | Confirma tu nuevo correo |
   | Reset Password | `recovery.html` | Restablece tu contraseña de Novalius |

   Las plantillas enlazan a `{{ .SiteURL }}/auth/confirmar?token_hash=…`, por eso la *Site URL* debe ser la correcta.
   En el plan gratuito Supabase solo permite editar plantillas con un SMTP propio (paso 6). Mientras tanto la web
   también acepta los enlaces de las plantillas estándar de Supabase (sesión en `#access_token=…`).
6. **Authentication → SMTP Settings**: configura un SMTP propio. El servidor de correo integrado de Supabase solo
   envía a miembros del equipo del proyecto y con un límite muy bajo, así que **sin SMTP propio los usuarios no
   recibirán los correos de verificación**. Puedes usar el mismo proveedor que para los avisos (ver §5).
7. **Project Settings → API**: copia la *Project URL*, la clave **publishable** y la clave **secret**
   (en proyectos antiguos: `anon` y `service_role`; también funcionan).

## 2. GitHub y Vercel

El código está en el repositorio de GitHub `frxxgn/Novaa`.

1. En [vercel.com](https://vercel.com) → *Add New… → Project* → importa el repositorio desde GitHub
   (autoriza la app de Vercel en GitHub si te lo pide).
2. Deja *Root Directory* en la raíz del repositorio. La instalación, el build, `dist/`, las reescrituras,
   las cabeceras y el cron los define `vercel.json`.
3. **Environment Variables** (Production y, si quieres, Preview):

   | Variable | Valor |
   | --- | --- |
   | `SITE_URL` | `https://tu-dominio` |
   | `VITE_SUPABASE_URL` / `SUPABASE_URL` | Project URL de Supabase |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY` | Clave publishable |
   | `SUPABASE_SECRET_KEY` | Clave secret (**solo** esta variable, nunca con prefijo `VITE_`) |
   | `APP_HASH_SALT` | Cadena aleatoria larga (p. ej. `openssl rand -hex 32`) |
   | `CRON_SECRET` | Cadena aleatoria larga; Vercel Cron la envía automáticamente |
   | `ANTHROPIC_API_KEY` | Opcional: activa Nova con IA (ver [NOVA.md](NOVA.md)) |
   | `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*` o `RESEND_API_KEY` | Opcional: avisos por correo (§5) |
   | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Opcional: avisos por WhatsApp (§5) |

4. *Deploy*. Cada `git push` a la rama de producción vuelve a desplegar; cada rama o PR obtiene una URL de vista previa.

### Qué configura `vercel.json`

- `/api/*`, `/sitemap.xml` y `/robots.txt` → una sola Vercel Function (`api/index.ts`, hasta 60 s para respuestas de Nova en streaming).
- El resto de rutas → `index.html` (aplicación de una sola página).
- Cabeceras de seguridad (CSP, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`) y caché inmutable de `/assets/*`.
- Cron diario `/api/cron/maintenance` (04:17 UTC): aplica la retención de datos, caduca cupones y cierra partidas abandonadas.

> La CSP permite `https://*.supabase.co`. Si usas un dominio personalizado de Supabase, añádelo a `connect-src`
> e `img-src` en `vercel.json`.

## 3. Dominio

1. Vercel → *Settings → Domains* → añade el dominio y crea los registros DNS que indica.
2. Actualiza `SITE_URL` en Vercel y la *Site URL* / *Redirect URLs* en Supabase.
3. Opcional: **Panel → Configuración → SEO → URL pública** (si se deja vacía se usa `SITE_URL`).
4. Comprueba `https://tu-dominio/robots.txt` y `https://tu-dominio/sitemap.xml`, y da de alta el sitemap en Google Search Console.

## 4. Primer administrador

Desde tu equipo (las claves solo se usan en local, no se guardan):

```bash
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=<clave-secret> \
  npx tsx scripts/create-admin.ts webnovalius@gmail.com "Nombre Apellido"
```

- Sin contraseña: se envía una **invitación** por correo (requiere el SMTP del paso 1.6).
- Con contraseña como tercer argumento: crea la cuenta ya verificada.
- Si el correo ya tiene cuenta, la promueve a administrador.

Después, el resto del equipo se invita desde **Panel → Usuarios y permisos**.

## 5. Integraciones opcionales

### Correo (avisos al equipo, al cliente y pruebas de envío)

- **SMTP** (`EMAIL_PROVIDER=smtp`): cualquier proveedor. Con Gmail, activa la verificación en dos pasos y crea una
  *contraseña de aplicación* (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`). Gmail limita el volumen diario.
- **Resend** (`EMAIL_PROVIDER=resend`): verifica tu dominio en Resend y usa un remitente de ese dominio en `EMAIL_FROM`.
- Prueba el envío en **Panel → Notificaciones → Enviar prueba**. Cada envío (correcto o fallido) queda registrado.

### WhatsApp Business (Cloud API de Meta)

1. Crea una app en Meta for Developers con el producto WhatsApp y un número de empresa verificado.
2. Crea y espera la aprobación de una **plantilla** de mensaje (p. ej. aviso de nuevo lead con variables).
3. Configura `WHATSAPP_TOKEN` (token permanente de usuario de sistema) y `WHATSAPP_PHONE_NUMBER_ID`.
4. En **Panel → Notificaciones** indica el número destinatario y el nombre exacto de la plantilla.

Meta cobra por conversación según su tarifa vigente. Sin estas variables el canal aparece como *no configurado*
y nunca se simula un envío.

## 6. Copias de seguridad

- Supabase hace copias diarias automáticas en los planes de pago (el plan gratuito no incluye restauración desde el panel).
- Copia manual de la base de datos:

  ```bash
  npx supabase db dump --linked -f backup-esquema.sql
  npx supabase db dump --linked --data-only -f backup-datos.sql
  ```

- Los archivos de Storage (medios y archivos de proyectos) se descargan desde el panel de Supabase o con su API.
- El contenido editorial también tiene **historial de versiones** dentro del propio panel (páginas y diseño).

## 7. Lista de comprobación tras el primer despliegue

- [ ] `https://tu-dominio/api/health` responde `"ok": true` con `database` y `auth` en `true`.
- [ ] Registro de una cuenta de prueba → llega el correo → el enlace abre `/auth/confirmar` y deja la sesión iniciada.
- [ ] Recuperación de contraseña de esa cuenta.
- [ ] Acceso a `/admin` con el administrador; **Configuración → Integraciones** muestra el estado real.
- [ ] Rellenar **Configuración → Empresa / Contacto / Privacidad** y revisar los textos de `/privacidad`, `/cookies` y `/terminos`.
- [ ] Revisar y marcar como revisadas las **Tarifas**.
- [ ] Conversación con Nova hasta dejar un contacto → aparece en **CRM** y llega el aviso configurado.
- [ ] Partida del Challenge con una cuenta verificada.
- [ ] Cabeceras: `curl -I https://tu-dominio` muestra `content-security-policy` y `strict-transport-security`.
