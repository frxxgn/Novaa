# Seguridad y privacidad

## Modelo de acceso

| Rol | Acceso |
| --- | --- |
| Visitante | Contenido publicado, Nova, formulario de contacto, estimaciones anónimas |
| Usuario | Lo anterior + su cuenta, sus presupuestos, el Challenge (con correo verificado) y sus cupones |
| Cliente | Lo anterior + sus proyectos, fases, tareas, archivos y novedades visibles |
| Equipo | Panel según permisos (19 permisos granulares; matriz editable en *Usuarios y permisos*) |
| Administrador | Todos los permisos |

- Los permisos se comprueban **en la base de datos** (`has_permission`, `has_role`, `is_project_client`) y, además, en la API.
  Ocultar un botón en la interfaz nunca es la única barrera.
- **RLS activado en todas las tablas** de `public`. Se revocan los privilegios por defecto de `anon` y `authenticated`
  y se conceden solo las operaciones necesarias, columna a columna donde importa (un usuario solo puede editar
  nombre, empresa, teléfono, avatar, idioma y preferencia de comunicaciones de su perfil).
- Las operaciones sensibles (publicar, restaurar versiones, canjear cupones, convertir leads, registrar respuestas
  del juego…) son funciones `SECURITY DEFINER` con `search_path` fijo que validan permisos internamente.
- Protección de roles: nadie puede modificar sus propios roles, solo un administrador gestiona administradores y no
  se puede eliminar al último administrador.
- **Storage:** `media` (público, solo lectura para visitantes; escritura con `content.manage`) y `project-files`
  (privado; cada archivo está bajo `{id_proyecto}/` y solo lo leen el equipo con `projects.manage` o el cliente del
  proyecto si está marcado como visible).

## API

- La clave secreta de Supabase y las de IA, correo y WhatsApp **solo existen en el servidor**. El navegador solo
  recibe la URL de Supabase y la clave publicable.
- Validación de toda entrada con esquemas (zod); los importes de un presupuesto **nunca** se aceptan del cliente.
- Las peticiones que modifican datos deben venir del mismo origen (control de `Origin`) y se autentican con token Bearer.
- Límites de uso por IP anonimizada (hash con sal) para Nova, formularios, presupuestos, analíticas y exportaciones,
  configurables en *Configuración → Seguridad*.
- Formulario de contacto con campo trampa (*honeypot*) y tiempo mínimo de cumplimentación.
- Exportación CSV protegida frente a inyección de fórmulas.
- Errores sin trazas ni detalles internos hacia el cliente.
- Tareas programadas protegidas con `CRON_SECRET`.

## Navegador

- **Content-Security-Policy** estricta: solo scripts propios (`script-src 'self'`), sin `eval`, `object-src 'none'`,
  conexiones solo al propio dominio y a Supabase, `frame-ancestors 'self'`.
- `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  (cámara, micrófono, geolocalización y pagos desactivados) y `Cross-Origin-Opener-Policy`.
- El editor visual **no ejecuta código**: las secciones son componentes predefinidos con propiedades validadas, el
  texto enriquecido se renderiza sin `innerHTML` y los enlaces se filtran (`javascript:` y similares se descartan).

## Novalius Challenge (antifraude)

- El servidor genera las preguntas, guarda la solución y mide el tiempo; el navegador nunca recibe las respuestas correctas.
- Tiempo total validado con la hora del servidor (con un pequeño margen de red) y tiempo mínimo humano por respuesta.
- Una sesión activa por usuario y juego, límites diarios de partidas e intentos y correo verificado obligatorio.
- El tres en raya valida cada movimiento en el servidor (no se pueden enviar tableros manipulados).
- **Un único cupón del Challenge por cuenta** (restricción única en base de datos), con caducidad y canje único registrado.

## Auditoría

`audit_logs` registra creación, modificación y borrado en las tablas de negocio y configuración, además de acciones
como accesos al panel, invitaciones o exportaciones. Ningún rol puede modificar ni borrar el registro (ni siquiera
un administrador desde la API). Consulta en **Panel → Auditoría** con el permiso `audit.read`.

## Privacidad (RGPD)

- **Consentimiento explícito** en el formulario de contacto y en la tarjeta de contacto de Nova (casilla no marcada
  por defecto); se guardan la fecha y la versión de la política aceptada. WhatsApp requiere una casilla aparte.
- **Banner de cookies** con dos opciones al mismo nivel («Solo lo necesario» / «Aceptar analíticas»); la elección
  se puede cambiar en cualquier momento desde el enlace del pie. La única categoría opcional es la analítica propia:
  sin servicios de terceros, sin cookies (un identificador temporal de sesión del navegador) y sin guardar la IP; no se registra nada hasta aceptar.
- **Derechos del usuario** desde `/cuenta`: descarga de sus datos (JSON), rectificación de su perfil y solicitud de
  supresión, que el equipo gestiona en *Usuarios y permisos → Solicitudes de privacidad*.
- **Retención** configurable (*Configuración → Privacidad*): conversaciones sin lead y eventos de analítica se borran
  automáticamente con la tarea diaria.
- **Minimización:** Nova tiene prohibido pedir datos sensibles y la IP se usa solo como *hash* para los límites de uso.
- **Encargados de tratamiento** que deben figurar en la política de privacidad: Supabase (alojamiento y base de datos),
  Vercel (hosting), Anthropic (si se activa la IA), el proveedor de correo elegido y Meta (si se activa WhatsApp).
  Revisa con cada uno el acuerdo de tratamiento de datos (DPA) y la ubicación de los datos.

> Los textos de `/privacidad`, `/cookies` y `/terminos` son **borradores** que usan los datos de
> *Configuración → Empresa*. Deben completarse y revisarse por un profesional antes de publicar la web.
