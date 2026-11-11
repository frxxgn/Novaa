# Informe de pruebas

Fecha de la última ejecución completa: **11/11/2026**, en local (Supabase CLI 3.1 con Postgres, Auth, Storage y
Mailpit; Node 22; Chromium de Playwright). El despliegue en Vercel/Supabase cloud no se ha podido probar desde el
entorno de desarrollo (ver [DESPLIEGUE.md](DESPLIEGUE.md)).

| Batería | Comando | Resultado |
| --- | --- | --- |
| Tipos (cliente + servidor) | `npm run typecheck` | Sin errores |
| Unitarias | `npm test` | **22 / 22** |
| Seguridad e integración (RLS, permisos, API) | `npm run test:security` | **73 / 73** |
| Nova con IA (API de Claude simulada) | `npm run test:nova` | **17 / 17** |
| Extremo a extremo en navegador (build de producción) | `npm run test:e2e` | **178 / 178** |

## Unitarias (`tests/unit`)

- **Motor de presupuestos:** base + diseño + funcionalidades con redondeo; funcionalidades incluidas no se cobran;
  páginas adicionales; plantilla como multiplicador; complejidad y plazo; unidades incluidas; mantenimiento separado;
  importe mínimo y amplitud mínima del rango; reglas inactivas; error sin tarifa base; referencias de mercado del
  mismo tipo con procedencia; validación de requisitos.
- **Juegos:** detección de ganador; Nova bloquea victorias inmediatas; sin errores Nova nunca pierde (minimax real);
  con tasa de error un jugador óptimo puede ganar (los niveles con recompensa son superables); selección de 10
  preguntas sin repetir con dificultad progresiva; evita preguntas recientes; la respuesta correcta solo vive en el
  estado del servidor; plazo validado con la hora del servidor.
- **Nova guiada:** recorre la cualificación y produce requisitos válidos; adapta preguntas al tipo de proyecto;
  no inventa respuestas a preguntas abiertas.

## Seguridad e integración (`tests/integration/security.ts`)

Contra Supabase real con usuarios de prueba creados al vuelo (no ejecutar contra producción):

- **Lectura pública:** el visitante lee servicios y páginas publicadas, pero no los ajustes privados ni las
  instrucciones de Nova (la configuración pública no las expone) y no puede insertar leads directamente en la base.
- **Escalada de privilegios:** un usuario no puede asignarse el rol de administrador, ni tocar columnas protegidas
  de su perfil (sí su nombre), ni ver el perfil de otro, ni crear cupones; el equipo no puede conceder el rol de
  administrador, ni leer o editar tarifas, ni publicar páginas sin `content.publish`; el administrador sí publica;
  nadie puede retirarse su propio rol; `my_access` devuelve los permisos correctos.
- **API:** token falso rechazado; sin sesión o sin correo verificado no se juega; el presupuesto se calcula en el
  servidor e ignora importes enviados por el cliente; reclamar un presupuesto exige su token y RLS aísla los
  presupuestos de cada usuario; leads sin consentimiento rechazados; lead del formulario creado; el equipo ve leads,
  un usuario no; el equipo no puede borrar leads.
- **Challenge:** respuesta fuera de plazo → partida terminada sin premio; no se puede jugar la partida de otro;
  **un único cupón por cuenta**; canje por el equipo; el cupón no es reutilizable; un usuario no puede canjear.
- **Portal de clientes:** el cliente ve solo sus proyectos visibles y no las tareas internas, no puede modificar su
  proyecto, otro usuario no ve proyectos ajenos; archivo privado: lo descarga su cliente, no otro usuario ni un
  anónimo; un usuario no puede subir a la biblioteca de medios.
- **Auditoría:** los cambios de roles quedan auditados, nadie puede borrar el registro y el equipo sin `audit.read`
  no lo lee.

## Nova con IA (`tests/integration/nova-ai.ts`)

Servidor local que imita la API de Claude con eventos SSE reales. Comprueba: conversación en modo IA, texto en
streaming, presupuesto calculado en el servidor a partir de la herramienta (JSON parcial), cierre con `done`,
modelo por defecto, razonamiento adaptativo y esfuerzo configurado, *fallbacks* del servidor, prompt de sistema con
caché, reglas de seguridad incluidas, solo herramientas autorizadas, la clave no viaja en el cuerpo, reenvío correcto
del razonamiento dentro del turno y del `tool_result`, historial guardado sin razonamiento y con `tool_use`/`tool_result`
emparejados, y que sin token no se puede escribir en una conversación ajena.

## Extremo a extremo (`tests/e2e/run.cjs`)

Sobre la build de producción servida por `server/node.ts`, en escritorio (1440 × 900) y móvil (iPhone 13):

1. **19 rutas públicas** (inicio, servicios, servicio, proyectos, proyecto, plantillas, plantilla, demo, nosotros,
   contacto, challenge, login, registro, recuperar, legales y 404): respuesta 200 sin errores de consola, `h1` y
   título, sin desbordamiento horizontal, imágenes con `alt` y botones con nombre accesible.
2. **SEO técnico:** `robots.txt`, `sitemap.xml` dinámico y cabeceras de seguridad.
3. **Registro real:** formulario → correo de verificación en Mailpit → enlace → sesión iniciada; partida de tres en
   raya completa; quiz con temporizador y corrección del servidor.
4. **Recuperación de contraseña** por correo e inicio de sesión con la nueva.
5. **Nova (modo guiado):** tarjeta de presupuesto, bloqueo sin consentimiento, lead enviado.
6. **Formulario de contacto** con plantilla de referencia.
7. **Panel:** el lead de Nova aparece en el CRM con su presupuesto; cambio de estado con historial; edición en el
   editor visual → publicar → visible en la web → restaurar versión → revertido; publicar diseño global → aplicado en la
   web (y revertido); sin errores de consola durante todo el recorrido. Además, las 18 secciones del panel se
   revisaron una a una (capturas de escritorio) sin errores de consola.
8. Un usuario normal **no** accede al panel.

## Cómo ejecutarlas

```bash
npm run db:start && npm run db:reset           # Supabase local con datos iniciales
npm run typecheck && npm test                  # tipos y unitarias
npm run test:security && npm run test:nova     # integración (usan .env.local)
VITE_SUPABASE_URL=/supabase npm run build
PORT=4173 SUPABASE_PROXY_TARGET=http://127.0.0.1:54321 npm run preview &
ADMIN_EMAIL=… ADMIN_PASSWORD=… npm run test:e2e   # administrador local; BASE y MAILPIT configurables
```

Las pruebas E2E crean cuentas, leads y cambios temporales en la base local; el propio script revierte los cambios
de contenido y diseño que publica.
