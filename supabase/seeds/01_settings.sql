-- =============================================================================
-- NOVALIUS · Contenido inicial · Ajustes, diseño y navegación
-- Datos de la empresa no facilitados (razón social, NIF, dirección, teléfono,
-- WhatsApp, redes) se dejan VACÍOS a propósito: la web los oculta hasta que se
-- completen desde el panel (Configuración).
-- =============================================================================

insert into public.site_settings (key, is_public, description, value) values
('company', true, 'Datos de la empresa', '{
  "name": "Novalius",
  "legal_name": "",
  "tax_id": "",
  "address": "",
  "tagline": "Creamos experiencias digitales que impulsan negocios",
  "description": "Estudio de desarrollo web, soluciones digitales, automatizaciones e inteligencia artificial."
}'),
('contact', true, 'Canales de contacto', '{
  "email": "webnovalius@gmail.com",
  "phone": "",
  "whatsapp": "",
  "whatsapp_message": "Hola, Novalius. Me gustaría hablar sobre un proyecto.",
  "hours": ""
}'),
('social', true, 'Redes sociales', '{"instagram": "", "linkedin": "", "x": "", "youtube": "", "tiktok": "", "github": ""}'),
('branding', true, 'Logotipo e iconos', '{
  "logo_dark_bg": "/brand/novalius-horizontal-dark.svg",
  "logo_light_bg": "/brand/novalius-horizontal-light.svg",
  "mark": "/brand/novalius-isotipo.svg",
  "favicon": "/favicon.svg",
  "nova_avatar": "/brand/nova-avatar.svg"
}'),
('seo_defaults', true, 'SEO global', '{
  "site_url": "",
  "title_template": "%s · Novalius",
  "default_title": "Novalius · Experiencias digitales que impulsan negocios",
  "description": "Desarrollo web, SEO, automatizaciones e inteligencia artificial para empresas. Habla con Nova y obtén un presupuesto orientativo en minutos.",
  "og_image": "/og-image.jpg",
  "twitter_handle": ""
}'),
('locales', true, 'Idiomas', '{"default": "es", "enabled": ["es"], "available": ["es", "en"]}'),
('cookies', true, 'Consentimiento de cookies', '{
  "version": "2026-11",
  "banner_title": "Tu privacidad, tus reglas",
  "banner_text": "Usamos almacenamiento técnico imprescindible para que la web funcione. Con tu permiso, también medimos visitas de forma anónima y sin cookies de terceros para mejorar la experiencia."
}'),
('privacy', true, 'Privacidad y retención', '{
  "consent_version": "2026-11",
  "conversation_retention_days": 365,
  "analytics_retention_days": 395,
  "lead_retention_note": "Los datos de contacto se conservan mientras exista una relación comercial o hasta que solicites su supresión."
}'),
('site_status', true, 'Estado de la web', '{"maintenance": false, "indexable": true, "message": "Estamos actualizando Novalius. Volvemos en unos minutos."}'),
('analytics', true, 'Analíticas propias', '{"enabled": true}'),
('challenge', true, 'Reglas de Novalius Challenge', '{
  "enabled": true,
  "quiz_questions": 10,
  "quiz_duration_seconds": 60,
  "quiz_grace_ms": 1500,
  "quiz_min_answer_ms": 350,
  "quiz_attempts_per_day": 5,
  "quiz_mix": {"1": 4, "2": 4, "3": 2},
  "ttt_attempts_per_day": 15,
  "ttt_levels": {
    "facil": {"label": "Fácil", "mistake_rate": 0.6},
    "normal": {"label": "Normal", "mistake_rate": 0.3},
    "experto": {"label": "Experto", "mistake_rate": 0.1}
  },
  "ttt_reward_levels": ["normal", "experto"],
  "coupon_percent": 5,
  "coupon_valid_days": 90,
  "coupon_conditions": "Descuento aplicable una sola vez sobre el precio de un nuevo proyecto contratado con Novalius. No acumulable con otras promociones ni canjeable por dinero."
}'),
('notifications', false, 'Canales de notificación', '{
  "email": {"enabled": true, "recipients": ["webnovalius@gmail.com"]},
  "whatsapp": {"enabled": false, "recipient": "", "template": ""},
  "internal": {"enabled": true},
  "events": {"new_lead": true, "proposal_requested": true, "handoff": true, "coupon_won": true, "privacy_request": true, "new_user": false}
}'),
('security', false, 'Límites de uso', '{
  "nova_per_minute": 12,
  "nova_per_day": 200,
  "leads_per_hour": 6,
  "quotes_per_hour": 20,
  "analytics_per_minute": 90,
  "games_per_minute": 60
}'),
('pricing', false, 'Presentación de presupuestos', '{
  "currency": "EUR",
  "vat_note": "Importes sin IVA.",
  "rounding": 50,
  "valid_days": 30,
  "reviewed": false,
  "disclaimer": "Estimación orientativa generada automáticamente a partir de la información facilitada. No constituye un presupuesto definitivo ni una oferta vinculante: el precio final se confirma en una propuesta personalizada tras analizar el proyecto."
}')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Diseño global: tokens extraídos del logotipo de referencia
--   tinta #010f40 · azul #07195e · índigo #301e9f · violeta #6c26e8
--   púrpura #a540fb · lavanda #c9b8f5 · plata #b9babe
-- -----------------------------------------------------------------------------
with t as (
  select '{
    "colors": {
      "primary": "#6c26e8",
      "secondary": "#a540fb",
      "lavender": "#c9b8f5",
      "ink": "#010f40",
      "navy": "#07195e",
      "indigo": "#301e9f",
      "silver": "#b9babe",
      "bg_dark": "#05061a",
      "surface_dark": "#0d0f2b",
      "bg_light": "#f6f4fd",
      "surface_light": "#ffffff",
      "text_on_dark": "#f3f1ff",
      "text_on_light": "#0b0c26",
      "success": "#15a36a",
      "warning": "#d98a06",
      "danger": "#e0364f",
      "info": "#2f6fe4"
    },
    "typography": {"display": "Sora", "body": "Inter", "mono": "IBM Plex Mono", "scale": 1, "display_weight": 600, "display_tracking": -0.045},
    "radius": {"sm": 10, "md": 18, "lg": 30},
    "spacing": {"section": 136, "container": 1320, "gutter": 24},
    "effects": {"glow": 0.55, "shadow": 0.22, "glass_opacity": 0.07, "glass_blur": 18, "border_opacity": 0.12, "noise": 0.04},
    "buttons": {"shape": "pill", "magnetic": true},
    "cards": {"style": "glass", "tilt": true}
  }'::jsonb as tokens,
  '{
    "enabled": true,
    "intro": true,
    "intro_duration": 2.4,
    "speed": 1,
    "intensity": 1,
    "scroll_reveal": "rise",
    "magnetic_strength": 0.35,
    "cursor": true,
    "smooth_scroll": true,
    "three_d": true,
    "particles": true,
    "page_transitions": true,
    "sound": true
  }'::jsonb as animations
)
insert into public.design_settings (status, tokens, animations, note, published_at)
select 'published'::public.version_status, tokens, animations, 'Diseño inicial', now() from t
union all
select 'draft'::public.version_status, tokens, animations, '', null from t;

-- -----------------------------------------------------------------------------
-- Navegación
-- -----------------------------------------------------------------------------
insert into public.navigation_items (menu, label, href, group_label, position, is_cta, i18n) values
  ('header', 'Servicios', '/servicios', '', 0, false, '{"en": {"label": "Services"}}'),
  ('header', 'Proyectos', '/proyectos', '', 1, false, '{"en": {"label": "Work"}}'),
  ('header', 'Plantillas', '/plantillas', '', 2, false, '{"en": {"label": "Templates"}}'),
  ('header', 'Challenge', '/challenge', '', 3, false, '{}'),
  ('header', 'Nosotros', '/nosotros', '', 4, false, '{"en": {"label": "About"}}'),
  ('header', 'Contacto', '/contacto', '', 5, false, '{"en": {"label": "Contact"}}'),
  ('header', 'Solicitar propuesta', '/contacto?intent=propuesta', '', 6, true, '{"en": {"label": "Request a proposal"}}'),

  ('footer', 'Diseño web', '/servicios/diseno-web', 'Servicios', 0, false, '{}'),
  ('footer', 'Automatizaciones con IA', '/servicios/automatizaciones-ia', 'Servicios', 1, false, '{}'),
  ('footer', 'Asistentes con IA', '/servicios/asistentes-ia', 'Servicios', 2, false, '{}'),
  ('footer', 'Aplicaciones web', '/servicios/aplicaciones-web', 'Servicios', 3, false, '{}'),
  ('footer', 'Todos los servicios', '/servicios', 'Servicios', 4, false, '{}'),
  ('footer', 'Proyectos', '/proyectos', 'Novalius', 10, false, '{}'),
  ('footer', 'Plantillas', '/plantillas', 'Novalius', 11, false, '{}'),
  ('footer', 'Nosotros', '/nosotros', 'Novalius', 12, false, '{}'),
  ('footer', 'Challenge', '/challenge', 'Novalius', 13, false, '{}'),
  ('footer', 'Contacto', '/contacto', 'Novalius', 14, false, '{}'),
  ('footer', 'Mi cuenta', '/cuenta', 'Clientes', 20, false, '{}'),
  ('footer', 'Iniciar sesión', '/login', 'Clientes', 21, false, '{}'),
  ('footer', 'Crear cuenta', '/registro', 'Clientes', 22, false, '{}'),

  ('legal', 'Privacidad', '/privacidad', '', 0, false, '{}'),
  ('legal', 'Cookies', '/cookies', '', 1, false, '{}'),
  ('legal', 'Términos', '/terminos', '', 2, false, '{}');
