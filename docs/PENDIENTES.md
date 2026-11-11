# Pendientes y limitaciones conocidas

## Integraciones que requieren tus cuentas

| Integración | Estado en el código | Qué falta | Verificado |
| --- | --- | --- | --- |
| **Supabase en la nube** | Migraciones, seeds y plantillas listas | Crear el proyecto, `db push`, configurar Auth y SMTP ([DESPLIEGUE.md](DESPLIEGUE.md) §1) | En local con Supabase CLI |
| **Vercel** | `vercel.json` y `api/index.ts` listos | Importar el repositorio con *Root Directory* `novalius` y variables de entorno | No (sin cuenta); probado el mismo código con `server/node.ts` |
| **Claude (Nova con IA)** | Implementado (streaming, herramientas, caché, *fallbacks*) | `ANTHROPIC_API_KEY` | Contra un servidor que imita la API; **falta una prueba con clave real** |
| **Correo de avisos** | SMTP y Resend | Elegir proveedor y credenciales | Con SMTP local (Mailpit): envío y contenido reales |
| **Correo de autenticación** | Plantillas propias en español | SMTP propio en Supabase | En local (registro, verificación, recuperación, invitación) |
| **WhatsApp Business** | Cloud API de Meta con plantillas | Cuenta de Meta, número verificado, plantilla aprobada y token | No (sin credenciales). Si falta, el canal figura como «no configurado» y no se simula |
| **Dominio** | Canonical, sitemap y robots dinámicos | Apuntar DNS y actualizar `SITE_URL` | — |

## Contenido y datos que debe completar Novalius

- **Datos de empresa:** razón social, NIF/CIF, dirección, teléfono, WhatsApp, horario y redes sociales están vacíos
  (solo se facilitó `webnovalius@gmail.com`). La web no muestra lo que esté vacío.
- **Textos legales:** `/privacidad`, `/cookies` y `/terminos` son borradores con marcadores (`{{company.legal_name}}`…).
  Requieren revisión profesional antes de publicar.
- **Tarifas:** las 46 reglas iniciales son **valores provisionales** para que el motor funcione. Mientras no se marque
  *Tarifas revisadas*, cada estimación lo advierte.
- **Referencias de mercado:** la tabla está vacía a propósito; no se han inventado precios de competidores. Añade
  solo rangos con fuente, URL y fecha comprobables.
- **Portfolio:** contiene la propia plataforma Novalius y tres proyectos **concepto**, marcados como tales. Sustitúyelos
  por casos reales cuando los haya.
- **Plantillas:** las 9 demos sectoriales usan negocios ficticios y así se indica.
- **Inglés:** la interfaz está preparada (textos base y editor de traducciones), pero el contenido de páginas y servicios
  está solo en español; el idioma inglés está desactivado hasta traducirlo.
- **Imágenes:** la identidad visual se ha construido con el logotipo facilitado, ilustraciones generadas por código y la
  escena 3D. No hay fotografías reales del equipo ni de proyectos.

## Limitaciones técnicas conocidas

- **SEO de aplicación de una sola página:** títulos, descripciones, canonical y JSON-LD se generan en el navegador.
  Google ejecuta JavaScript y los indexa, pero las vistas previas al compartir enlaces en redes (que no ejecutan
  JavaScript) muestran los metadatos generales de `index.html` en todas las páginas. Si se necesitan vistas previas
  por página, el siguiente paso es el prerenderizado o el renderizado en servidor.
- **Notificaciones del panel:** se actualizan cada 30 segundos (sin tiempo real) para no depender de Supabase Realtime.
- **Límites de uso:** se guardan en Postgres; son adecuados para tráfico moderado. Con mucho tráfico conviene moverlos
  a un almacén en memoria (p. ej. Redis) o al firewall de Vercel.
- **Escena 3D:** la librería 3D pesa unos 240 KB comprimidos; se carga bajo demanda, solo si el navegador admite WebGL
  y las animaciones están activas. Sin ella se muestra una versión estática.
- **Cupones:** no hay pasarela de pago; el equipo aplica el descuento manualmente y registra el canje en el panel.
- **Editor visual:** trabaja con secciones predefinidas y propiedades validadas. Es una decisión de seguridad: no admite
  HTML, CSS ni scripts libres. Nuevos tipos de sección requieren desarrollo.
- **Copias de seguridad:** dependen del plan de Supabase (el plan gratuito no permite restaurar desde el panel).
- **Plan gratuito de Vercel:** el cron se ejecuta una vez al día, que es lo que necesita la tarea de mantenimiento.
