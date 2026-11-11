# NOVALIUS · Plataforma web

Web corporativa, asistente comercial **Nova**, motor de presupuestos, CRM, portal de clientes,
**Novalius Challenge** y panel de administración completo, sobre una base de datos real con
seguridad a nivel de fila (Supabase) y una API propia (Hono).

> Repositorio propio de NOVALIUS. Se despliega en Vercel desde la raíz del repositorio
> (sin *Root Directory*) y usa Supabase como base de datos y autenticación.

## Estado

| Área | Estado |
| --- | --- |
| Web pública (inicio, servicios ×11, proyectos, plantillas ×9, nosotros, contacto, legales) | Funcional, editable desde el panel |
| Nova (asistente) | Funcional. **Modo guiado** sin clave de IA; **modo IA** (Claude) al configurar `ANTHROPIC_API_KEY` |
| Presupuestos | Calculados en el servidor con reglas editables. **Los importes iniciales son provisionales**: revísalos en *Tarifas* |
| Registro, login, verificación y recuperación por correo | Funcional (Supabase Auth, plantillas propias en español) |
| Novalius Challenge (quiz 60 s + tres en raya contra Nova) y cupón del 5 % | Funcional, validado en el servidor |
| Panel `/admin` (editor visual, diseño, contenido, CRM, clientes, proyectos, Nova, tarifas, usuarios, notificaciones, analíticas, ajustes, auditoría) | Funcional |
| Portal de cliente `/cuenta` | Funcional, aislado por RLS |
| Correo a equipo y clientes | Funciona con SMTP o Resend (hay que configurar uno) |
| WhatsApp | Implementado con WhatsApp Cloud API; **requiere cuenta de Meta y plantilla aprobada** |
| Textos legales | **Borradores** con datos de empresa por completar y revisión legal pendiente |

Todo lo anterior se ha comprobado en local con pruebas automáticas: ver [docs/PRUEBAS.md](docs/PRUEBAS.md).
Lo que falta conectar o revisar está en [docs/PENDIENTES.md](docs/PENDIENTES.md).

## Documentación

| Documento | Contenido |
| --- | --- |
| [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md) | Supabase en producción, Vercel, GitHub, dominio, primer administrador, copias de seguridad |
| [docs/MANUAL-ADMIN.md](docs/MANUAL-ADMIN.md) | Uso del panel: editor visual, publicación, CRM, tarifas, Nova, usuarios… |
| [docs/NOVA.md](docs/NOVA.md) | Cómo funciona Nova, cómo activar la IA, costes y reglas de seguridad |
| [docs/SEGURIDAD-Y-PRIVACIDAD.md](docs/SEGURIDAD-Y-PRIVACIDAD.md) | Roles, RLS, cabeceras, límites, auditoría, RGPD |
| [docs/PRUEBAS.md](docs/PRUEBAS.md) | Informe de pruebas y cómo ejecutarlas |
| [docs/PENDIENTES.md](docs/PENDIENTES.md) | Integraciones pendientes y limitaciones conocidas |

## Tecnología

- **Frontend:** React 19, Vite 8, TypeScript estricto, Tailwind CSS 4 (tokens `--nv-*` editables desde el panel),
  Motion, Three.js + React Three Fiber (esfera 3D con shader propio), Lenis, React Router 7, TanStack Query.
- **API:** Hono 4 en una única función (`/api/*`). En Vercel se ejecuta como Vercel Function (`api/index.ts`);
  fuera de Vercel, con `server/node.ts`.
- **Datos y autenticación:** Supabase (Postgres + Auth + Storage). RLS en todas las tablas, funciones
  `SECURITY DEFINER` para operaciones sensibles, auditoría con triggers.
- **IA:** Claude mediante `@anthropic-ai/sdk` (streaming, herramientas propias, *prompt caching*).
- **Correo:** SMTP (nodemailer) o Resend. **WhatsApp:** Cloud API de Meta.

## Estructura

```
novalius/
├── api/index.ts               # Entrada de Vercel (toda la API)
├── server/                    # API: rutas, Nova, presupuestos, leads, juegos, notificaciones
│   ├── app.ts                 # Aplicación Hono (cabeceras, CSRF, errores, cron)
│   ├── node.ts                # Servidor Node para previsualización / hosting propio
│   ├── routes/                # public, nova, games, account, admin
│   ├── nova/                  # Configuración, prompt, herramientas, modo IA y modo guiado
│   ├── pricing/ quotes/ leads/ games/ notify/
├── src/
│   ├── app/                   # Router, sesión, ajustes del sitio, preferencias
│   ├── features/              # cms (secciones), nova, games, admin, account, auth, …
│   ├── shared/                # Código compartido cliente/servidor (precios, tres en raya)
│   └── i18n/                  # es (completo) y en (preparado)
├── supabase/
│   ├── migrations/            # Esquema, RLS, funciones, storage
│   ├── seeds/                 # Contenido inicial, reglas de precios, preguntas
│   └── templates/             # Plantillas de correo de autenticación
├── tests/                     # unit (vitest), integration (RLS/API, Nova), e2e (Playwright)
├── scripts/                   # create-admin, dev-api, generate-brand-assets
├── vercel.json                # Reescrituras, cabeceras de seguridad, cron
└── .env.example               # Variables documentadas (sin secretos)
```

## Puesta en marcha en local

Requisitos: Node 20.19+ (probado con 22), Docker (para Supabase local).

```bash
git clone https://github.com/frxxgn/Novaa.git
cd Novaa
npm install
npm run db:start                 # Supabase local (Postgres, Auth, Storage, Mailpit)
npm run db:reset                 # Aplica migraciones y datos iniciales
cp .env.example .env.local       # Rellena las claves que muestra `npx supabase status`
npm run admin:create -- tu@correo.com "Tu nombre" "UnaContraseñaLarga1"
npm run dev                      # http://localhost:5173 (web + API en el mismo servidor)
```

- Panel: `http://localhost:5173/admin` con el usuario creado.
- Correos de desarrollo (verificación, recuperación, avisos): Mailpit en `http://127.0.0.1:54324`.
- Sin `ANTHROPIC_API_KEY`, Nova funciona en modo guiado (indicado en la propia interfaz).

### Previsualización de producción

```bash
VITE_SUPABASE_URL=/supabase npm run build
PORT=4173 SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 npm run preview
```

`SUPABASE_PROXY_TARGET` sirve Supabase bajo el mismo origen (`/supabase/*`), útil cuando el navegador
no puede acceder directamente al puerto de Supabase.

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Web + API con recarga en caliente |
| `npm run build` | Comprobación de tipos (cliente y servidor) y build de producción en `dist/` |
| `npm run preview` / `npm start` | Sirve `dist/` y la API con Node |
| `npm run typecheck` | Solo comprobación de tipos |
| `npm test` | Pruebas unitarias (motor de precios, juegos, Nova guiada) |
| `npm run test:security` | RLS, permisos, escalada de privilegios, cupones, storage, auditoría (necesita Supabase local) |
| `npm run test:nova` | Flujo de Nova con IA contra un servidor simulado de la API de Claude |
| `npm run test:e2e` | Navegador real contra la previsualización (`BASE=http://localhost:4173`) |
| `npm run db:start` / `db:reset` / `db:stop` | Supabase local |
| `npm run admin:create` | Crea o promueve un administrador |
| `npm run brand:assets` | Regenera iconos PNG y la imagen Open Graph desde los SVG de marca |

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Resumen:

- **Públicas (navegador):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- **Servidor:** `SITE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `APP_HASH_SALT`, `CRON_SECRET`.
- **Opcionales:** `ANTHROPIC_API_KEY` (+ `NOVA_MODEL`), correo (`EMAIL_PROVIDER`, `SMTP_*` o `RESEND_API_KEY`, `EMAIL_FROM`),
  WhatsApp (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`).

Ninguna clave secreta lleva prefijo `VITE_` ni se envía al navegador. El estado de cada integración se ve en
**Panel → Configuración → Integraciones**.

## Contacto del proyecto

Correo facilitado por Novalius: **webnovalius@gmail.com**. El resto de datos de contacto (teléfono, dirección,
redes, datos fiscales) se dejan vacíos hasta que se rellenen en **Panel → Configuración**; la web oculta lo que no
está configurado.
