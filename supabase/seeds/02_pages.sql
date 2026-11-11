-- =============================================================================
-- NOVALIUS · Contenido inicial · Páginas gestionables (CMS)
-- =============================================================================

create or replace function pg_temp.page(p_path text, p_title text, p_kind text, p_system boolean, p_seo jsonb)
returns uuid language sql as $$
  insert into public.pages (path, title, kind, is_system, seo)
  values (p_path, p_title, p_kind, p_system, p_seo)
  returning id;
$$;

create or replace function pg_temp.sec(p_path text, p_pos integer, p_type text, p_label text, p_props jsonb, p_style jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into public.page_sections (page_id, type, label, props, style, position)
  select id, p_type, p_label, p_props, p_style, p_pos from public.pages where path = p_path;
$$;

-- -----------------------------------------------------------------------------
-- Inicio
-- -----------------------------------------------------------------------------
select pg_temp.page('/', 'Inicio', 'landing', true, '{
  "title": "Novalius · Experiencias digitales que impulsan negocios",
  "description": "Diseño y desarrollo web, SEO, automatizaciones e inteligencia artificial para empresas. Habla con Nova y obtén un presupuesto orientativo en minutos."
}');

select pg_temp.sec('/', 0, 'hero', 'Hero principal', '{
  "eyebrow": "Estudio digital · Inteligencia artificial · Producto",
  "title": "CREAMOS EXPERIENCIAS DIGITALES QUE IMPULSAN NEGOCIOS",
  "highlight": "IMPULSAN",
  "subtitle": "Transformamos ideas en experiencias digitales, soluciones inteligentes y herramientas que ayudan a las empresas a evolucionar.",
  "primary": {"label": "SOLICITAR UNA PROPUESTA", "href": "/contacto?intent=propuesta"},
  "secondary": {"label": "EXPLORAR NOVALIUS", "href": "#explorar"},
  "visual": "orb",
  "badges": ["Web", "IA", "Automatización", "SEO"]
}', '{"tone": "dark"}');

select pg_temp.sec('/', 1, 'marquee', 'Cinta de capacidades', '{
  "items": ["Diseño web", "SEO técnico", "Automatizaciones con IA", "Asistentes virtuales", "Paneles a medida", "Bases de datos", "Integraciones", "Aplicaciones web", "Mantenimiento y seguridad"]
}', '{"tone": "dark"}');

select pg_temp.sec('/', 2, 'statement', 'Manifiesto', '{
  "anchor": "explorar",
  "eyebrow": "Manifiesto",
  "text": "Una web no es un folleto. Es la primera conversación con tu cliente, tu comercial más constante y la herramienta que ordena tu negocio.",
  "highlight": "tu comercial más constante",
  "body": "En Novalius diseñamos cada proyecto para esas tres funciones a la vez: que impresione, que convierta y que trabaje por ti cuando no estás mirando."
}', '{"tone": "light"}');

select pg_temp.sec('/', 3, 'services_showcase', 'Servicios', '{
  "eyebrow": "Servicios",
  "title": "Todo lo que tu negocio necesita para operar en digital",
  "subtitle": "Once disciplinas, un mismo equipo. Elige una o combínalas: las diseñamos para que funcionen juntas.",
  "cta": {"label": "Ver todos los servicios", "href": "/servicios"}
}', '{"tone": "dark"}');

select pg_temp.sec('/', 4, 'process', 'Proceso', '{
  "eyebrow": "Método",
  "title": "Así trabajamos",
  "subtitle": "Un proceso claro y sin sorpresas: en cada momento sabes qué estamos haciendo, por qué y qué viene después.",
  "steps": [
    {"title": "Descubrimiento", "text": "Entendemos tu negocio, tus clientes y el problema real que queremos resolver."},
    {"title": "Definición", "text": "Concretamos alcance, funcionalidades, plazos y presupuesto en una propuesta por escrito."},
    {"title": "Diseño de experiencia", "text": "Arquitectura, prototipos e identidad visual. Validas cada pantalla antes de programarla."},
    {"title": "Desarrollo", "text": "Construimos con tecnología moderna, segura y rápida, con entregas parciales que puedes revisar."},
    {"title": "Pruebas", "text": "Rendimiento, accesibilidad, seguridad y dispositivos reales. Nada sale sin pasar el control."},
    {"title": "Entrega", "text": "Publicamos, formamos a tu equipo y te entregamos accesos y documentación."},
    {"title": "Evolución", "text": "Mantenimiento, métricas y mejoras continuas para que el proyecto crezca contigo."}
  ]
}', '{"tone": "light"}');

select pg_temp.sec('/', 5, 'nova_cta', 'Nova', '{
  "eyebrow": "Asistente inteligente",
  "title": "Habla con Nova",
  "text": "Nova entiende lo que necesitas, te recomienda la mejor solución y calcula un presupuesto orientativo en minutos. Sin formularios eternos ni esperas.",
  "prompts": ["Quiero una web para mi restaurante", "¿Cuánto cuesta un chatbot con IA?", "Necesito automatizar las reservas", "Quiero rediseñar mi web antigua"]
}', '{"tone": "dark"}');

select pg_temp.sec('/', 6, 'templates_teaser', 'Plantillas', '{
  "eyebrow": "Plantillas",
  "title": "Demos que ya funcionan",
  "subtitle": "Explora webs reales por sector. Ábrelas, navégalas desde tu móvil y pide una igual adaptada a tu marca.",
  "cta": {"label": "Explorar plantillas", "href": "/plantillas"},
  "limit": 6
}', '{"tone": "light"}');

select pg_temp.sec('/', 7, 'portfolio_teaser', 'Proyectos', '{
  "eyebrow": "Proyectos",
  "title": "Laboratorio y casos",
  "subtitle": "Proyectos propios y conceptos de laboratorio, identificados siempre como tal.",
  "cta": {"label": "Ver proyectos", "href": "/proyectos"},
  "limit": 4
}', '{"tone": "dark"}');

select pg_temp.sec('/', 8, 'challenge_teaser', 'Challenge', '{
  "eyebrow": "Novalius Challenge",
  "title": "Juega. Gana. Ahorra un 5 %.",
  "text": "Diez preguntas en sesenta segundos o una partida de tres en raya contra Nova. Supera el reto y desbloquea un cupón de descuento para tu proyecto.",
  "cta": {"label": "Aceptar el reto", "href": "/challenge"}
}', '{"tone": "violet"}');

select pg_temp.sec('/', 9, 'faq', 'Preguntas frecuentes', '{
  "eyebrow": "FAQ",
  "title": "Preguntas frecuentes",
  "scope": "general"
}', '{"tone": "light"}');

select pg_temp.sec('/', 10, 'cta', 'Llamada final', '{
  "title": "¿Hablamos de tu proyecto?",
  "text": "Cuéntanos qué necesitas. Te respondemos con una propuesta clara: alcance, plazos y precio.",
  "primary": {"label": "Solicitar una propuesta", "href": "/contacto?intent=propuesta"},
  "secondary": {"label": "Hablar con Nova", "href": "#nova"}
}', '{"tone": "dark"}');

-- -----------------------------------------------------------------------------
-- Páginas de módulo (contenido editable + módulo funcional)
-- -----------------------------------------------------------------------------
select pg_temp.page('/servicios', 'Servicios', 'system', true, '{
  "title": "Servicios",
  "description": "Diseño web, SEO, automatizaciones con IA, asistentes virtuales, paneles, bases de datos, integraciones, mantenimiento y aplicaciones web a medida."
}');
select pg_temp.sec('/servicios', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Servicios",
  "title": "Tecnología con criterio, diseño con intención",
  "subtitle": "Cada servicio resuelve un problema concreto de tu negocio. Explóralos, combínalos y pide a Nova una estimación al instante."
}', '{"tone": "dark"}');
select pg_temp.sec('/servicios', 1, 'module', 'Listado de servicios', '{"module": "services_index"}', '{"tone": "dark"}');
select pg_temp.sec('/servicios', 2, 'cta', 'Llamada a la acción', '{
  "title": "¿No sabes por dónde empezar?",
  "text": "Describe tu negocio a Nova y te recomendará la combinación de servicios que mejor encaja.",
  "primary": {"label": "Hablar con Nova", "href": "#nova"},
  "secondary": {"label": "Solicitar propuesta", "href": "/contacto?intent=propuesta"}
}', '{"tone": "violet"}');

select pg_temp.page('/proyectos', 'Proyectos', 'system', true, '{
  "title": "Proyectos",
  "description": "Proyectos de Novalius y conceptos de laboratorio identificados como tal."
}');
select pg_temp.sec('/proyectos', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Proyectos",
  "title": "Lo que construimos",
  "subtitle": "Proyectos propios y conceptos de laboratorio. Cuando un proyecto es una demostración, lo indicamos claramente."
}', '{"tone": "dark"}');
select pg_temp.sec('/proyectos', 1, 'module', 'Portfolio', '{"module": "portfolio_index"}', '{"tone": "dark"}');
select pg_temp.sec('/proyectos', 2, 'cta', 'Llamada a la acción', '{
  "title": "Tu proyecto puede ser el siguiente",
  "text": "Cuéntanos tu idea y la convertimos en un producto digital que funcione.",
  "primary": {"label": "Solicitar una propuesta", "href": "/contacto?intent=propuesta"}
}', '{"tone": "light"}');

select pg_temp.page('/plantillas', 'Plantillas', 'system', true, '{
  "title": "Plantillas por sector",
  "description": "Demos funcionales de webs para restaurantes, barberías, clínicas, constructoras, talleres, tiendas, despachos y profesionales."
}');
select pg_temp.sec('/plantillas', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Plantillas",
  "title": "Encuentra la base de tu próxima web",
  "subtitle": "Demos reales y navegables por sector. Pruébalas en móvil, tablet o escritorio y pide una versión a medida para tu negocio."
}', '{"tone": "dark"}');
select pg_temp.sec('/plantillas', 1, 'module', 'Galería', '{"module": "templates_index"}', '{"tone": "dark"}');

select pg_temp.page('/contacto', 'Contacto', 'system', true, '{
  "title": "Contacto",
  "description": "Solicita una propuesta, habla con Nova o escríbenos a webnovalius@gmail.com."
}');
select pg_temp.sec('/contacto', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Contacto",
  "title": "Empecemos por una buena conversación",
  "subtitle": "Habla con Nova para obtener una estimación inmediata o déjanos tus datos y te respondemos con una propuesta personalizada."
}', '{"tone": "dark"}');
select pg_temp.sec('/contacto', 1, 'module', 'Contacto', '{"module": "contact"}', '{"tone": "dark"}');

select pg_temp.page('/challenge', 'Novalius Challenge', 'system', true, '{
  "title": "Novalius Challenge",
  "description": "Juega al quiz de 10 preguntas o al tres en raya contra Nova y gana un cupón de descuento del 5 %."
}');
select pg_temp.sec('/challenge', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Novalius Challenge",
  "title": "Dos retos. Un premio.",
  "subtitle": "Elige tu juego. Si ganas, desbloqueas un cupón único del 5 % para tu proyecto con Novalius."
}', '{"tone": "dark"}');
select pg_temp.sec('/challenge', 1, 'module', 'Juegos', '{"module": "challenge"}', '{"tone": "dark"}');
select pg_temp.sec('/challenge', 2, 'faq', 'Bases y preguntas', '{"eyebrow": "Bases", "title": "Cómo funciona", "scope": "challenge"}', '{"tone": "light"}');

-- -----------------------------------------------------------------------------
-- Nosotros
-- -----------------------------------------------------------------------------
select pg_temp.page('/nosotros', 'Nosotros', 'standard', true, '{
  "title": "Nosotros",
  "description": "Novalius une diseño, ingeniería e inteligencia artificial para crear herramientas digitales que hacen crecer negocios."
}');
select pg_temp.sec('/nosotros', 0, 'page_header', 'Cabecera', '{
  "eyebrow": "Nosotros",
  "title": "Diseño, ingeniería e inteligencia artificial bajo el mismo techo",
  "subtitle": "Novalius nace para que cualquier empresa pueda tener la experiencia digital que antes solo estaba al alcance de las grandes marcas."
}', '{"tone": "dark"}');
select pg_temp.sec('/nosotros', 1, 'statement', 'Propósito', '{
  "eyebrow": "Propósito",
  "text": "Creemos que la tecnología tiene que notarse en los resultados, no en la complejidad.",
  "highlight": "en los resultados",
  "body": "Por eso cada decisión de diseño y de código responde a una pregunta sencilla: ¿esto ayuda a tu negocio a vender más, atender mejor o trabajar con menos fricción?"
}', '{"tone": "light"}');
select pg_temp.sec('/nosotros', 2, 'features_grid', 'Principios', '{
  "eyebrow": "Principios",
  "title": "Cómo pensamos",
  "items": [
    {"icon": "crosshair", "title": "Precisión", "text": "Cada píxel y cada línea de código tienen un motivo. Si algo no aporta, no entra."},
    {"icon": "eye", "title": "Transparencia", "text": "Propuestas claras, plazos realistas y acceso al estado de tu proyecto en todo momento."},
    {"icon": "gauge", "title": "Rendimiento", "text": "Webs rápidas, accesibles y bien posicionadas. La velocidad también es diseño."},
    {"icon": "shield-check", "title": "Seguridad", "text": "Buenas prácticas desde el primer día: permisos, cifrado, copias y actualizaciones."},
    {"icon": "key-round", "title": "Propiedad", "text": "Tu web, tus datos y tus accesos son tuyos. Sin ataduras artificiales."},
    {"icon": "trending-up", "title": "Evolución", "text": "Medimos, aprendemos y mejoramos. Un proyecto digital nunca está terminado."}
  ]
}', '{"tone": "dark"}');
select pg_temp.sec('/nosotros', 3, 'cta', 'Llamada a la acción', '{
  "title": "Construyamos algo que funcione",
  "text": "Cuéntanos tu reto y te proponemos el camino más directo para resolverlo.",
  "primary": {"label": "Solicitar una propuesta", "href": "/contacto?intent=propuesta"},
  "secondary": {"label": "Ver servicios", "href": "/servicios"}
}', '{"tone": "violet"}');

-- -----------------------------------------------------------------------------
-- Páginas legales (BORRADOR: requieren revisión jurídica y datos de la empresa)
-- -----------------------------------------------------------------------------
select pg_temp.page('/privacidad', 'Política de privacidad', 'legal', true, '{"title": "Política de privacidad", "description": "Cómo trata Novalius los datos personales."}');
select pg_temp.sec('/privacidad', 0, 'page_header', 'Cabecera', '{"eyebrow": "Legal", "title": "Política de privacidad", "subtitle": "Versión 2026-11 · Borrador pendiente de revisión jurídica"}', '{"tone": "dark"}');
select pg_temp.sec('/privacidad', 1, 'rich_text', 'Texto', $json${
  "notice": "Este texto es un borrador inicial. Antes de publicar la web debe revisarlo un profesional y completarse con la razón social, el NIF y la dirección de Novalius desde el panel.",
  "body": "## Responsable del tratamiento\nNovalius ({{company.legal_name}}, NIF {{company.tax_id}}, {{company.address}}). Correo de contacto: {{contact.email}}.\n\n## Qué datos tratamos y para qué\n- **Solicitudes de contacto y presupuestos**: nombre, empresa, correo, teléfono o WhatsApp (si lo facilitas) y la descripción de tu proyecto, para responderte y preparar propuestas.\n- **Conversaciones con Nova**: los mensajes que escribes al asistente, para atender tu consulta, calcular estimaciones orientativas y, si lo autorizas expresamente, enviar tus datos al equipo comercial.\n- **Cuenta de usuario**: correo, nombre y datos de perfil, para gestionar tu acceso, tus presupuestos guardados, tus cupones y, si eres cliente, tus proyectos.\n- **Novalius Challenge**: resultados de las partidas y cupones obtenidos, para aplicar las bases del juego y prevenir fraudes.\n- **Analíticas propias**: solo si das tu consentimiento, registramos páginas visitadas y clics de forma agregada, sin cookies de terceros y sin almacenar tu dirección IP.\n\n## Base jurídica\nAplicación de medidas precontractuales a petición tuya (contacto y presupuestos), ejecución del contrato (cuenta y proyectos), consentimiento (analíticas y comunicaciones comerciales) e interés legítimo en la seguridad de la plataforma y la prevención del fraude.\n\n## Uso de inteligencia artificial\nNova es un asistente basado en inteligencia artificial. Sus respuestas son orientativas y pueden contener errores. Las estimaciones económicas se calculan con reglas configuradas por Novalius y no constituyen una oferta vinculante. No introduzcas datos sensibles en la conversación.\n\n## Conservación\nLas conversaciones con Nova que no derivan en una solicitud se conservan {{privacy.conversation_retention_days}} días. Los datos de contacto se conservan mientras exista una relación comercial o hasta que solicites su supresión, y después durante los plazos legales aplicables.\n\n## Destinatarios y encargados del tratamiento\nUtilizamos proveedores tecnológicos que tratan datos por cuenta de Novalius: alojamiento y base de datos (Supabase), despliegue web (Vercel), proveedor de inteligencia artificial (Anthropic) y proveedor de correo electrónico. Si se activa la integración de WhatsApp, Meta Platforms tratará los mensajes enviados por ese canal. Algunos proveedores pueden estar ubicados fuera del Espacio Económico Europeo; en ese caso, las transferencias se amparan en las garantías previstas por el RGPD.\n\n## Tus derechos\nPuedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a {{contact.email}} o desde tu cuenta (Perfil · Privacidad). También puedes reclamar ante la Agencia Española de Protección de Datos (www.aepd.es)."
}$json$::jsonb, '{"tone": "light"}');

select pg_temp.page('/cookies', 'Política de cookies', 'legal', true, '{"title": "Política de cookies", "description": "Qué almacenamiento utiliza la web de Novalius y cómo gestionarlo."}');
select pg_temp.sec('/cookies', 0, 'page_header', 'Cabecera', '{"eyebrow": "Legal", "title": "Política de cookies", "subtitle": "Versión 2026-11 · Borrador pendiente de revisión jurídica"}', '{"tone": "dark"}');
select pg_temp.sec('/cookies', 1, 'rich_text', 'Texto', $json${
  "notice": "Borrador inicial. Revísalo si añades servicios de terceros (mapas, vídeos incrustados, píxeles publicitarios).",
  "body": "## Qué utilizamos\nEsta web no instala cookies publicitarias ni de terceros. Utilizamos almacenamiento local del navegador con estas finalidades:\n\n- **Técnico (siempre activo)**: mantener tu sesión iniciada, recordar tu elección de cookies, el idioma y preferencias como el sonido o la animación de entrada.\n- **Analítica propia (opcional)**: un identificador aleatorio de sesión, guardado solo durante la visita, para contar páginas vistas y clics de forma agregada. Solo se activa si lo aceptas.\n\n## Cómo cambiar tu elección\nPuedes cambiar tu consentimiento en cualquier momento desde el enlace «Preferencias de privacidad» del pie de página. También puedes borrar el almacenamiento desde la configuración de tu navegador."
}$json$::jsonb, '{"tone": "light"}');

select pg_temp.page('/terminos', 'Términos y condiciones', 'legal', true, '{"title": "Términos y condiciones", "description": "Condiciones de uso de la web, de Nova, de los presupuestos orientativos y de Novalius Challenge."}');
select pg_temp.sec('/terminos', 0, 'page_header', 'Cabecera', '{"eyebrow": "Legal", "title": "Términos y condiciones", "subtitle": "Versión 2026-11 · Borrador pendiente de revisión jurídica"}', '{"tone": "dark"}');
select pg_temp.sec('/terminos', 1, 'rich_text', 'Texto', $json${
  "notice": "Borrador inicial. Debe revisarlo un profesional antes de su publicación definitiva.",
  "body": "## Uso de la web\nEl acceso a la web es libre. Algunas funciones (presupuestos guardados, juegos, cupones y portal de clientes) requieren una cuenta. Eres responsable de la veracidad de los datos que facilitas y de la confidencialidad de tu contraseña.\n\n## Presupuestos orientativos\nLas estimaciones que ofrece Nova o la web son orientativas, se calculan automáticamente con la información facilitada y no constituyen una oferta vinculante. El precio definitivo se fija en una propuesta personalizada aceptada por ambas partes.\n\n## Novalius Challenge\n- Para participar necesitas una cuenta verificada.\n- Quiz: debes responder correctamente las diez preguntas dentro del tiempo indicado, medido por nuestros servidores.\n- Tres en raya: debes ganar la partida en un nivel que otorgue recompensa.\n- Se concede como máximo un cupón por cuenta. El cupón es personal, intransferible, de un solo uso, caduca en la fecha indicada y no es canjeable por dinero.\n- Novalius puede anular partidas o cupones obtenidos mediante automatismos, cuentas múltiples o manipulación del juego.\n\n## Propiedad intelectual\nLos contenidos, el diseño y el código de esta web pertenecen a Novalius o a sus licenciantes. Las plantillas de demostración muestran negocios ficticios.\n\n## Responsabilidad\nNovalius trabaja para que la web esté disponible y sea segura, pero no puede garantizar la ausencia total de interrupciones o errores.\n\n## Legislación aplicable\nEstas condiciones se rigen por la legislación española."
}$json$::jsonb, '{"tone": "light"}');

-- -----------------------------------------------------------------------------
-- Publicar la versión 1 de todas las páginas
-- -----------------------------------------------------------------------------
insert into public.page_versions (page_id, version, snapshot, note)
select id, 1, public.page_draft_snapshot(id), 'Versión inicial' from public.pages;

update public.pages p
   set published_version_id = v.id, has_unpublished_changes = false
  from public.page_versions v
 where v.page_id = p.id and v.version = 1;
