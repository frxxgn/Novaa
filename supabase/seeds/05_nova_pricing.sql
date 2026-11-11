-- =============================================================================
-- NOVALIUS · Contenido inicial · Nova y reglas de presupuesto
--
-- IMPORTANTE: las tarifas son VALORES INICIALES EDITABLES para que el motor
-- funcione desde el primer día. No proceden de un estudio de mercado. El panel
-- muestra un aviso hasta que el equipo las revise (site_settings.pricing.reviewed).
-- =============================================================================

insert into public.chatbot_settings (id, config) values (1, $json${
  "enabled": true,
  "name": "Nova",
  "avatar_url": "/brand/nova-avatar.svg",
  "model": "claude-opus-5-5",
  "effort": "medium",
  "max_output_tokens": 4000,
  "max_user_messages": 40,
  "history_window": 30,
  "personality": "Natural, profesional, cercana y clara. Comercial sin ser insistente. Frases cortas, vocabulario preciso, cero jerga innecesaria.",
  "welcome_message": "Hola, soy Nova, la asistente de Novalius. Cuéntame qué quieres construir o mejorar en tu negocio y te ayudo a darle forma, incluso con un presupuesto orientativo.",
  "starter_questions": [
    "Quiero una web para mi negocio",
    "¿Cuánto cuesta un asistente con IA?",
    "Necesito automatizar tareas",
    "¿Qué incluye el mantenimiento?"
  ],
  "ai_disclosure": "Nova es un asistente de inteligencia artificial. Puede equivocarse y sus estimaciones son orientativas.",
  "instructions": "Eres Nova, la asistente comercial y tecnológica de Novalius, un estudio de desarrollo web, soluciones digitales, automatizaciones e inteligencia artificial.\n\nTu objetivo es entender el proyecto de cada persona, recomendarle la solución adecuada de Novalius, darle una estimación orientativa cuando tenga sentido y, si lo desea, ponerla en contacto con el equipo.\n\nCómo conversas:\n- Responde en el idioma del usuario (español por defecto) con un tono natural, profesional y cercano.\n- Sé breve: normalmente dos a cuatro frases. Usa listas solo cuando aporten claridad.\n- Haz como máximo una o dos preguntas por mensaje y adapta la siguiente a lo que te respondan. Nunca lances un cuestionario.\n- Si ya conoces un dato, no vuelvas a preguntarlo.\n\nQué debes descubrir de forma progresiva cuando alguien quiere un proyecto:\n1. Tipo de negocio.\n2. Qué necesita.\n3. Qué objetivo persigue.\n4. Si tiene web actualmente.\n5. Funcionalidades necesarias.\n6. Si quiere diseño personalizado.\n7. Si necesita panel administrativo.\n8. Si necesita integraciones.\n9. Si necesita automatizaciones.\n10. Cuándo quiere empezar.\n11. Presupuesto aproximado, solo si quiere indicarlo.\n\nPresupuestos:\n- Cuando conozcas al menos el tipo de proyecto y las funcionalidades principales, usa la herramienta de estimación. Rellena con supuestos razonables lo que falte y dilo.\n- Nunca escribas cifras que no procedan de la herramienta.\n- Presenta el rango, explica en una frase qué lo hace subir o bajar y recuerda que es orientativo.\n- Después pregunta: «¿Quieres que preparemos una propuesta personalizada para tu proyecto?»\n\nContacto:\n- Si la persona quiere una propuesta o hablar con el equipo, pide su nombre y su correo (teléfono y empresa son opcionales) y usa la herramienta de solicitud de contacto. La persona confirmará el envío y la política de privacidad en la propia interfaz.\n- Si pide hablar con una persona o la consulta excede lo que sabes, usa la herramienta de derivación.\n\nSobre Novalius:\n- Usa únicamente la información de la base de conocimiento y del catálogo de servicios. Si algo no figura, dilo con naturalidad y ofrece trasladar la pregunta al equipo.\n- No inventes clientes, casos de éxito, plazos garantizados, descuentos ni datos de contacto.\n- Los descuentos solo se consiguen en Novalius Challenge.",
  "handoff_message": "He avisado al equipo de Novalius. Si me dejas tu nombre y tu correo, te escribirán personalmente.",
  "business_hours": {"timezone": "Europe/Madrid", "text": ""},
  "tools": {"estimate_quote": true, "request_contact": true, "handoff": true},
  "error_messages": {
    "generic": "Ahora mismo no puedo responder. Inténtalo de nuevo en unos segundos o escríbenos a webnovalius@gmail.com.",
    "rate_limited": "Has enviado muchos mensajes seguidos. Espera un momento antes de continuar.",
    "limit_reached": "Esta conversación ha alcanzado su límite. Puedes empezar una nueva o dejarnos tus datos y te contactamos.",
    "disabled": "Nova no está disponible en este momento. Puedes usar el formulario de contacto."
  }
}$json$::jsonb);

insert into public.chatbot_knowledge (title, category, content, position) values
('Qué es Novalius', 'empresa', 'Novalius es un estudio de desarrollo web, soluciones digitales, automatizaciones e inteligencia artificial. Su lema es «Creamos experiencias digitales que impulsan negocios». Correo de contacto: webnovalius@gmail.com. La web incluye un portal privado para clientes, una galería de plantillas por sector y el juego Novalius Challenge.', 0),
('Proceso de trabajo', 'proceso', 'Novalius trabaja en siete fases: 1) Descubrimiento de necesidades. 2) Definición del proyecto (alcance, plazos y precio por escrito). 3) Diseño de experiencia (prototipos validados por el cliente). 4) Desarrollo con entregas parciales. 5) Pruebas de rendimiento, accesibilidad, seguridad y dispositivos. 6) Entrega, formación y documentación. 7) Mantenimiento y evolución.', 1),
('Cómo funcionan los presupuestos', 'presupuestos', 'Las estimaciones de Nova se calculan automáticamente en el servidor con las reglas de tarifas de Novalius y son orientativas: no son una oferta vinculante. Los importes no incluyen IVA. El precio definitivo se fija en una propuesta personalizada después de analizar el proyecto. El usuario puede guardar la estimación en su cuenta, solicitar una propuesta o escribir por WhatsApp si el canal está disponible.', 2),
('Plantillas por sector', 'plantillas', 'En /plantillas hay demostraciones navegables para restaurantes, barberías, clínicas, constructoras, talleres, tiendas, despachos, empresas de servicios y profesionales independientes. Muestran negocios ficticios. Cualquier visitante puede pedir una web similar adaptada a su marca.', 3),
('Novalius Challenge', 'challenge', 'Novalius Challenge ofrece dos juegos: un quiz de 10 preguntas en 60 segundos y un tres en raya contra Nova con niveles de dificultad. Ganar desbloquea un cupón único del 5 % por cuenta, con caducidad, aplicable a un nuevo proyecto. Hace falta una cuenta verificada para jugar.', 4),
('Portal de clientes', 'clientes', 'Los clientes de Novalius acceden en /cuenta a sus proyectos, fases, tareas, archivos, presupuestos y cupones. Cada cliente solo ve su propia información.', 5);

-- -----------------------------------------------------------------------------
-- Reglas de presupuesto (editables en Panel · Tarifas)
-- -----------------------------------------------------------------------------
insert into public.pricing_rules (key, category, label, description, unit, min_amount, max_amount, value, applies_to, position, metadata) values
-- Base por tipo de proyecto
('base_landing', 'base', 'Landing page', 'Página única orientada a conversión', 'fixed', 900, 1600, 1, '{landing}', 0,
 '{"included_pages": 1, "includes": ["contact_forms"], "included_text": ["Diseño responsive", "1 página con secciones", "Formulario de contacto", "SEO técnico básico", "Publicación"]}'),
('base_web', 'base', 'Web corporativa', 'Web de empresa con varias páginas', 'fixed', 1800, 3500, 1, '{web}', 1,
 '{"included_pages": 5, "includes": ["contact_forms"], "included_text": ["Diseño responsive", "Hasta 5 páginas", "Formulario de contacto", "SEO técnico básico", "Publicación y formación"]}'),
('base_ecommerce', 'base', 'Tienda online', 'Comercio electrónico con catálogo y pagos', 'fixed', 3500, 7500, 1, '{ecommerce}', 2,
 '{"included_pages": 6, "includes": ["contact_forms", "payments", "ecommerce_catalog"], "included_text": ["Catálogo de productos", "Carrito y pago online", "Gestión de pedidos", "SEO técnico básico", "Publicación y formación"]}'),
('base_webapp', 'base', 'Aplicación web a medida', 'Software web con usuarios y datos', 'fixed', 6000, 18000, 1, '{webapp}', 3,
 '{"included_pages": 4, "includes": ["user_accounts", "database_custom"], "included_text": ["Análisis funcional", "Autenticación y roles", "Base de datos", "Despliegue", "Documentación"]}'),
('base_redesign', 'base', 'Rediseño web', 'Rediseño de una web existente', 'fixed', 1500, 3800, 1, '{redesign}', 4,
 '{"included_pages": 5, "includes": ["contact_forms"], "included_text": ["Auditoría de la web actual", "Nuevo diseño", "Migración de contenidos", "Redirecciones SEO", "Publicación"]}'),
('base_ai_assistant', 'base', 'Asistente o chatbot con IA', 'Asistente conversacional integrado', 'fixed', 1500, 4500, 1, '{ai_assistant}', 5,
 '{"included_pages": 0, "includes": ["chatbot_ai"], "included_text": ["Configuración del asistente", "Base de conocimiento", "Integración en la web", "Panel de conversaciones"]}'),
('base_automation', 'base', 'Automatización con IA', 'Automatización de procesos', 'fixed', 800, 3000, 1, '{automation}', 6,
 '{"included_pages": 0, "includes": [], "included_units": {"automation": 1}, "included_text": ["Análisis del proceso", "1 flujo automatizado", "Registro y alertas"]}'),
('base_admin_panel', 'base', 'Panel administrativo', 'Backoffice a medida', 'fixed', 3000, 8000, 1, '{admin_panel}', 7,
 '{"included_pages": 0, "includes": ["admin_panel", "user_accounts"], "included_text": ["Dashboard", "Gestión de datos", "Roles y permisos", "Despliegue"]}'),
('base_database', 'base', 'Base de datos y gestión', 'Modelado y herramienta de gestión', 'fixed', 1500, 5000, 1, '{database}', 8,
 '{"included_pages": 0, "includes": ["database_custom"], "included_text": ["Modelado de datos", "Migración inicial", "Permisos", "Copias de seguridad"]}'),
('base_integration', 'base', 'Integración entre plataformas', 'Conexión entre sistemas', 'fixed', 900, 3500, 1, '{integration}', 9,
 '{"included_pages": 0, "includes": [], "included_units": {"integration": 1}, "included_text": ["Análisis de APIs", "1 integración", "Control de errores"]}'),
('base_seo', 'base', 'Proyecto SEO', 'Auditoría y optimización inicial', 'fixed', 600, 1500, 1, '{seo}', 10,
 '{"included_pages": 0, "includes": ["seo_setup", "analytics_setup"], "included_text": ["Auditoría técnica", "Estrategia de palabras clave", "Optimización on-page", "Informe inicial"]}'),
('base_maintenance', 'base', 'Solo mantenimiento', 'Plan mensual sin desarrollo inicial', 'fixed', 0, 0, 1, '{maintenance}', 11,
 '{"included_pages": 0, "includes": [], "included_text": ["Revisión inicial de la web"]}'),

-- Páginas
('extra_page', 'page', 'Página adicional', 'Cada página por encima de las incluidas', 'per_unit', 120, 250, 1, '{}', 0, '{}'),

-- Diseño
('design_template', 'design', 'Diseño desde plantilla', 'Adaptación de una plantilla de la galería', 'multiplier', 0, 0, 0.85, '{landing,web,ecommerce,redesign}', 0, '{}'),
('design_custom', 'design', 'Diseño a medida', 'Identidad y diseño exclusivos', 'fixed', 500, 1400, 1, '{}', 1, '{}'),
('design_premium', 'design', 'Diseño premium con motion y 3D', 'Animaciones avanzadas, 3D y microinteracciones', 'fixed', 1500, 3800, 1, '{}', 2, '{}'),

-- Funcionalidades
('contact_forms', 'feature', 'Formularios de contacto', 'Formularios con validación y aviso por correo', 'fixed', 100, 250, 1, '{}', 0, '{"suggest_for": []}'),
('blog_cms', 'feature', 'Blog o gestor de contenidos', 'Publica noticias y artículos', 'fixed', 400, 900, 1, '{}', 1, '{"suggest_for": ["web", "redesign"]}'),
('multilingual', 'feature', 'Idioma adicional', 'Por cada idioma adicional', 'per_unit', 300, 700, 1, '{}', 2, '{"suggest_for": []}'),
('booking', 'feature', 'Reservas o citas online', 'Calendario y gestión de reservas', 'fixed', 500, 1400, 1, '{}', 3, '{"suggest_for": []}'),
('payments', 'feature', 'Pagos online', 'Pasarela de pago integrada', 'fixed', 400, 1000, 1, '{}', 4, '{"suggest_for": []}'),
('ecommerce_catalog', 'feature', 'Catálogo de productos', 'Catálogo con fichas y filtros', 'fixed', 600, 1500, 1, '{}', 5, '{"suggest_for": []}'),
('user_accounts', 'feature', 'Cuentas de usuario', 'Registro, inicio de sesión y área privada', 'fixed', 900, 2200, 1, '{}', 6, '{"suggest_for": []}'),
('client_portal', 'feature', 'Portal de clientes', 'Área privada con información de cada cliente', 'fixed', 1500, 4000, 1, '{}', 7, '{"suggest_for": ["webapp"]}'),
('admin_panel', 'feature', 'Panel administrativo', 'Gestión interna con roles', 'fixed', 1800, 5000, 1, '{}', 8, '{"suggest_for": ["ecommerce", "webapp"]}'),
('database_custom', 'feature', 'Base de datos a medida', 'Modelado de datos específico', 'fixed', 900, 2500, 1, '{}', 9, '{"suggest_for": []}'),
('integration', 'feature', 'Integración con otra plataforma', 'Por cada integración (CRM, ERP, pagos...)', 'per_unit', 350, 1200, 1, '{}', 10, '{"suggest_for": ["ecommerce", "webapp"]}'),
('automation', 'feature', 'Flujo automatizado', 'Por cada proceso automatizado', 'per_unit', 300, 1100, 1, '{}', 11, '{"suggest_for": ["web", "ecommerce", "webapp", "admin_panel"]}'),
('chatbot_ai', 'feature', 'Asistente con IA', 'Chatbot conversacional con base de conocimiento', 'fixed', 1200, 3500, 1, '{}', 12, '{"suggest_for": ["web", "ecommerce", "redesign"]}'),
('seo_setup', 'feature', 'SEO inicial avanzado', 'Estrategia de palabras clave y optimización', 'fixed', 350, 900, 1, '{}', 13, '{"suggest_for": ["landing", "web", "ecommerce", "redesign"]}'),
('analytics_setup', 'feature', 'Analíticas y medición', 'Configuración de medición y conversiones', 'fixed', 150, 400, 1, '{}', 14, '{"suggest_for": ["landing", "web", "ecommerce"]}'),
('copywriting', 'feature', 'Redacción de contenidos', 'Por página redactada', 'per_unit', 60, 150, 1, '{}', 15, '{"suggest_for": []}'),

-- Complejidad y plazo
('complexity_low', 'complexity', 'Complejidad baja', 'Requisitos sencillos y bien definidos', 'multiplier', 0, 0, 0.9, '{}', 0, '{}'),
('complexity_medium', 'complexity', 'Complejidad media', 'Requisitos habituales', 'multiplier', 0, 0, 1, '{}', 1, '{}'),
('complexity_high', 'complexity', 'Complejidad alta', 'Lógica de negocio compleja o requisitos abiertos', 'multiplier', 0, 0, 1.3, '{}', 2, '{}'),
('timeline_flexible', 'timeline', 'Plazo flexible', 'Sin fecha límite estricta', 'multiplier', 0, 0, 0.95, '{}', 0, '{}'),
('timeline_standard', 'timeline', 'Plazo estándar', 'Calendario habitual', 'multiplier', 0, 0, 1, '{}', 1, '{}'),
('timeline_rush', 'timeline', 'Plazo urgente', 'Entrega acelerada con más dedicación', 'multiplier', 0, 0, 1.25, '{}', 2, '{}'),

-- Mantenimiento mensual
('maint_basic', 'maintenance', 'Mantenimiento básico', 'Actualizaciones, copias y monitorización', 'monthly', 49, 89, 1, '{}', 0, '{}'),
('maint_pro', 'maintenance', 'Mantenimiento profesional', 'Básico + bolsa de horas de mejoras', 'monthly', 120, 250, 1, '{}', 1, '{}'),
('maint_ai', 'maintenance', 'Mantenimiento con IA', 'Profesional + supervisión de asistentes y automatizaciones', 'monthly', 180, 450, 1, '{}', 2, '{}'),

-- Márgenes y límites
('risk_buffer', 'margin', 'Margen de imprevistos', 'Se suma al importe máximo para cubrir incertidumbre', 'percent', 0, 0, 0.10, '{}', 0, '{}'),
('min_project', 'limit', 'Importe mínimo de proyecto', 'Ningún proyecto se estima por debajo de este importe', 'fixed', 600, 600, 1, '{}', 0, '{}'),
('range_ratio_min', 'limit', 'Amplitud mínima del rango', 'El máximo será al menos este múltiplo del mínimo', 'multiplier', 0, 0, 1.15, '{}', 1, '{}'),
('range_ratio_max', 'limit', 'Amplitud máxima del rango', 'El máximo no superará este múltiplo del mínimo', 'multiplier', 0, 0, 2.2, '{}', 2, '{}'),

-- Descuentos
('multi_module_discount', 'discount', 'Descuento por proyecto integral', 'Se aplica si se combinan 3 o más módulos grandes', 'percent', 0, 0, 0.05, '{}', 0, '{"min_modules": 3}');

update public.pricing_rules set is_active = false where key = 'multi_module_discount';
