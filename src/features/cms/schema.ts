// Esquemas de edición de cada tipo de sección. El editor visual del panel genera
// los formularios a partir de estas definiciones: añadir un tipo nuevo consiste
// en declarar su esquema y su componente (registry.tsx).

export type FieldType = "text" | "textarea" | "richtext" | "number" | "switch" | "select" | "link" | "list" | "strings" | "image" | "icon" | "color";

export interface FieldDef {
  name: string;
  label: string;
  type: FieldType;
  help?: string;
  options?: { value: string; label: string }[];
  fields?: FieldDef[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  maxLength?: number;
}

export interface SectionSchema {
  type: string;
  label: string;
  description: string;
  icon: string;
  fields: FieldDef[];
  defaults: Record<string, unknown>;
  defaultTone: "dark" | "light" | "violet";
}

const link = (name: string, label: string): FieldDef => ({ name, label, type: "link" });

export const STYLE_FIELDS: FieldDef[] = [
  {
    name: "tone",
    label: "Fondo",
    type: "select",
    options: [
      { value: "dark", label: "Oscuro" },
      { value: "light", label: "Claro" },
      { value: "violet", label: "Violeta (degradado)" },
    ],
  },
  {
    name: "spacing",
    label: "Espaciado vertical",
    type: "select",
    options: [
      { value: "compact", label: "Compacto" },
      { value: "normal", label: "Normal" },
      { value: "spacious", label: "Amplio" },
    ],
  },
  {
    name: "align",
    label: "Alineación del texto",
    type: "select",
    options: [
      { value: "left", label: "Izquierda" },
      { value: "center", label: "Centrada" },
    ],
  },
  { name: "anchor", label: "Ancla (id)", type: "text", help: "Permite enlazar a la sección con #ancla. Solo minúsculas y guiones." },
];

export const SECTION_SCHEMAS: SectionSchema[] = [
  {
    type: "hero",
    label: "Hero principal",
    description: "Titular gigante, subtítulo, botones y elemento 3D.",
    icon: "sparkles",
    defaultTone: "dark",
    defaults: { eyebrow: "", title: "Titular de impacto", highlight: "", subtitle: "", primary: { label: "Solicitar propuesta", href: "/contacto" }, secondary: { label: "", href: "" }, visual: "orb", badges: [] },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text", maxLength: 120 },
      { name: "title", label: "Titular", type: "textarea", maxLength: 160 },
      { name: "highlight", label: "Palabra destacada", type: "text", help: "Se pinta con el degradado de marca." },
      { name: "subtitle", label: "Texto secundario", type: "textarea", maxLength: 400 },
      link("primary", "Botón principal"),
      link("secondary", "Botón secundario"),
      {
        name: "visual",
        label: "Elemento visual",
        type: "select",
        options: [
          { value: "orb", label: "Esfera 3D Nova" },
          { value: "none", label: "Ninguno" },
        ],
      },
      { name: "badges", label: "Etiquetas", type: "strings" },
    ],
  },
  {
    type: "marquee",
    label: "Cinta animada",
    description: "Lista de palabras en desplazamiento continuo.",
    icon: "layers",
    defaultTone: "dark",
    defaults: { items: ["Diseño", "Desarrollo", "IA"] },
    fields: [{ name: "items", label: "Elementos", type: "strings" }],
  },
  {
    type: "statement",
    label: "Manifiesto",
    description: "Frase grande con palabras destacadas.",
    icon: "message-square",
    defaultTone: "light",
    defaults: { eyebrow: "", text: "Una frase con personalidad.", highlight: "", body: "" },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "text", label: "Frase principal", type: "textarea", maxLength: 400 },
      { name: "highlight", label: "Palabras destacadas", type: "text" },
      { name: "body", label: "Texto complementario", type: "textarea" },
    ],
  },
  {
    type: "services_showcase",
    label: "Escaparate de servicios",
    description: "Servicios publicados con vista interactiva.",
    icon: "layout-dashboard",
    defaultTone: "dark",
    defaults: { eyebrow: "Servicios", title: "Servicios", subtitle: "", cta: { label: "Ver todos", href: "/servicios" } },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "subtitle", label: "Subtítulo", type: "textarea" },
      link("cta", "Botón"),
    ],
  },
  {
    type: "process",
    label: "Proceso de trabajo",
    description: "Pasos con presentación dinámica.",
    icon: "workflow",
    defaultTone: "light",
    defaults: { eyebrow: "Método", title: "Así trabajamos", subtitle: "", steps: [{ title: "Paso", text: "Descripción" }] },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "subtitle", label: "Subtítulo", type: "textarea" },
      {
        name: "steps",
        label: "Pasos",
        type: "list",
        fields: [
          { name: "title", label: "Título", type: "text" },
          { name: "text", label: "Descripción", type: "textarea" },
        ],
      },
    ],
  },
  {
    type: "nova_cta",
    label: "Llamada a Nova",
    description: "Invita a conversar con el asistente.",
    icon: "bot",
    defaultTone: "dark",
    defaults: { eyebrow: "", title: "Habla con Nova", text: "", prompts: [] },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "text", label: "Texto", type: "textarea" },
      { name: "prompts", label: "Preguntas sugeridas", type: "strings" },
    ],
  },
  {
    type: "templates_teaser",
    label: "Plantillas destacadas",
    description: "Muestra demos de la galería.",
    icon: "app-window",
    defaultTone: "light",
    defaults: { eyebrow: "", title: "Plantillas", subtitle: "", cta: { label: "Ver galería", href: "/plantillas" }, limit: 6 },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "subtitle", label: "Subtítulo", type: "textarea" },
      link("cta", "Botón"),
      { name: "limit", label: "Número de plantillas", type: "number", min: 1, max: 12 },
    ],
  },
  {
    type: "portfolio_teaser",
    label: "Proyectos destacados",
    description: "Tarjetas del portfolio.",
    icon: "briefcase",
    defaultTone: "dark",
    defaults: { eyebrow: "", title: "Proyectos", subtitle: "", cta: { label: "Ver proyectos", href: "/proyectos" }, limit: 4 },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "subtitle", label: "Subtítulo", type: "textarea" },
      link("cta", "Botón"),
      { name: "limit", label: "Número de proyectos", type: "number", min: 1, max: 12 },
    ],
  },
  {
    type: "challenge_teaser",
    label: "Novalius Challenge",
    description: "Invitación a los juegos.",
    icon: "target",
    defaultTone: "violet",
    defaults: { eyebrow: "Challenge", title: "Juega y gana", text: "", cta: { label: "Jugar", href: "/challenge" } },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "text", label: "Texto", type: "textarea" },
      link("cta", "Botón"),
    ],
  },
  {
    type: "features_grid",
    label: "Rejilla de características",
    description: "Tarjetas con icono, título y texto.",
    icon: "gem",
    defaultTone: "dark",
    defaults: { eyebrow: "", title: "", items: [{ icon: "sparkles", title: "Título", text: "Texto" }] },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      {
        name: "items",
        label: "Elementos",
        type: "list",
        fields: [
          { name: "icon", label: "Icono", type: "icon" },
          { name: "title", label: "Título", type: "text" },
          { name: "text", label: "Texto", type: "textarea" },
        ],
      },
    ],
  },
  {
    type: "split",
    label: "Texto e imagen",
    description: "Bloque a dos columnas con imagen o vídeo.",
    icon: "layers",
    defaultTone: "light",
    defaults: { eyebrow: "", title: "Título", text: "", image: "", image_alt: "", bullets: [], reverse: false, cta: { label: "", href: "" } },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      { name: "text", label: "Texto", type: "richtext" },
      { name: "image", label: "Imagen o vídeo", type: "image" },
      { name: "image_alt", label: "Texto alternativo", type: "text" },
      { name: "bullets", label: "Puntos clave", type: "strings" },
      { name: "reverse", label: "Imagen a la izquierda", type: "switch" },
      link("cta", "Botón"),
    ],
  },
  {
    type: "media",
    label: "Imagen o vídeo",
    description: "Recurso multimedia a ancho completo.",
    icon: "eye",
    defaultTone: "dark",
    defaults: { src: "", alt: "", caption: "", aspect: "16/9" },
    fields: [
      { name: "src", label: "Archivo", type: "image" },
      { name: "alt", label: "Texto alternativo", type: "text" },
      { name: "caption", label: "Pie", type: "text" },
      {
        name: "aspect",
        label: "Proporción",
        type: "select",
        options: [
          { value: "16/9", label: "16:9" },
          { value: "4/3", label: "4:3" },
          { value: "21/9", label: "21:9" },
          { value: "1/1", label: "1:1" },
        ],
      },
    ],
  },
  {
    type: "faq",
    label: "Preguntas frecuentes",
    description: "Acordeón con las FAQ del ámbito elegido.",
    icon: "lightbulb",
    defaultTone: "light",
    defaults: { eyebrow: "FAQ", title: "Preguntas frecuentes", scope: "general" },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "text" },
      {
        name: "scope",
        label: "Ámbito",
        type: "select",
        options: [
          { value: "general", label: "General" },
          { value: "challenge", label: "Challenge" },
          { value: "account", label: "Cuenta" },
        ],
      },
    ],
  },
  {
    type: "cta",
    label: "Llamada a la acción",
    description: "Bloque de conversión con dos botones.",
    icon: "rocket",
    defaultTone: "dark",
    defaults: { title: "¿Hablamos?", text: "", primary: { label: "Contactar", href: "/contacto" }, secondary: { label: "", href: "" } },
    fields: [
      { name: "title", label: "Título", type: "text" },
      { name: "text", label: "Texto", type: "textarea" },
      link("primary", "Botón principal"),
      link("secondary", "Botón secundario"),
    ],
  },
  {
    type: "page_header",
    label: "Cabecera de página",
    description: "Título de página interna.",
    icon: "star",
    defaultTone: "dark",
    defaults: { eyebrow: "", title: "Título de la página", subtitle: "" },
    fields: [
      { name: "eyebrow", label: "Antetítulo", type: "text" },
      { name: "title", label: "Título", type: "textarea" },
      { name: "subtitle", label: "Subtítulo", type: "textarea" },
    ],
  },
  {
    type: "rich_text",
    label: "Texto enriquecido",
    description: "Contenido largo con títulos y listas (Markdown).",
    icon: "code",
    defaultTone: "light",
    defaults: { title: "", notice: "", body: "## Título\nTexto del apartado." },
    fields: [
      { name: "title", label: "Título", type: "text" },
      { name: "notice", label: "Aviso destacado", type: "textarea" },
      { name: "body", label: "Contenido", type: "richtext", help: "Admite ## títulos, listas con «-», **negrita** y [enlaces](/ruta). Usa {{contact.email}} o {{company.legal_name}} para insertar datos de la empresa." },
    ],
  },
  {
    type: "module",
    label: "Módulo funcional",
    description: "Inserta una funcionalidad de la plataforma.",
    icon: "cpu",
    defaultTone: "dark",
    defaults: { module: "contact" },
    fields: [
      {
        name: "module",
        label: "Módulo",
        type: "select",
        options: [
          { value: "services_index", label: "Listado de servicios" },
          { value: "portfolio_index", label: "Portfolio" },
          { value: "templates_index", label: "Galería de plantillas" },
          { value: "contact", label: "Contacto (Nova + formulario)" },
          { value: "challenge", label: "Novalius Challenge" },
        ],
      },
    ],
  },
];

export const SCHEMA_BY_TYPE = Object.fromEntries(SECTION_SCHEMAS.map((s) => [s.type, s]));
