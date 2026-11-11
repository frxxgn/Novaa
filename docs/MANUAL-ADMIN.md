# Manual del panel de administración (`/admin`)

El panel solo es accesible para cuentas con rol **equipo** o **administrador**. Cada sección exige un permiso
concreto: si no lo tienes, no aparece en el menú y la base de datos rechaza la operación aunque se intente por
otra vía. Todo cambio relevante queda en **Auditoría**.

- **Búsqueda rápida:** `Ctrl/⌘ + K` abre la paleta de comandos para saltar a cualquier sección.
- **Notificaciones internas:** campana de la barra superior (nuevos leads, solicitudes de propuesta, derivaciones de Nova…).
- **Roles:** *Administrador* (todos los permisos), *Equipo* (operación diaria: contenido, CRM, clientes, proyectos,
  conversaciones de Nova, cupones, analíticas), *Cliente* (solo su portal), *Usuario* (cuenta registrada).

---

## Dashboard

Datos reales del periodo elegido: leads por estado y origen, cartera estimada (suma de los importes estimados de los leads abiertos),
presupuestos y propuestas solicitadas, usuarios y clientes, proyectos activos, conversaciones de Nova, partidas del
Challenge y cupones, visitas (solo de visitantes que aceptaron analíticas) y evolución diaria.

## Sitio web

### Páginas y editor visual

**Páginas** lista todas las páginas (publicadas, borradores y con cambios sin publicar). Desde aquí se crean,
duplican, despublican o eliminan páginas. Las páginas de sistema (servicios, proyectos, cuenta…) no se pueden borrar.

El **editor visual** tiene tres zonas:

1. **Estructura** (izquierda): secciones de la página. Se reordenan arrastrando o con las flechas, se ocultan/muestran con el ojo y se añaden con *Añadir sección*.
2. **Vista previa** (centro): la página real renderizada con el borrador, a tamaño de escritorio grande, portátil, tablet o móvil. Haz clic en una sección para seleccionarla.
3. **Propiedades** (derecha): campos de la sección seleccionada (textos, botones, imágenes, fondo claro/oscuro/violeta, espaciado, alineación, ancla) o, sin sección seleccionada, los ajustes de la página (título, ruta, SEO con vista previa del resultado en Google).

Tipos de sección disponibles: Hero principal, Cinta animada, Manifiesto, Escaparate de servicios, Proceso de trabajo,
Llamada a Nova, Plantillas destacadas, Proyectos destacados, Novalius Challenge, Rejilla de características,
Texto e imagen, Imagen o vídeo, Preguntas frecuentes, Llamada a la acción, Cabecera de página, Texto enriquecido
y Módulo funcional (formulario de contacto, juegos, etc.).

Flujo de trabajo:

- **Guardar** (`Ctrl/⌘ + S`) guarda el **borrador**; la web pública no cambia.
- **Comparar** muestra el borrador frente a la versión publicada.
- **Publicar** crea una versión nueva (con nota opcional) y la pone en línea al instante.
- **Historial de versiones** permite ver y **restaurar** cualquier versión anterior (la restauración vuelve al borrador para que la revises antes de publicar).

El editor no permite insertar HTML ni scripts: los textos enriquecidos admiten un Markdown limitado y los enlaces se validan.

### Diseño global y animaciones

- **Diseño global:** colores de marca, superficies claras/oscuras, tipografías (Sora, Inter, Manrope, Space Grotesk, Fraunces, Oswald), escala de titulares, radios, estilo de botones y tarjetas. Se edita un borrador con vista previa en vivo y se **publica**; las versiones anteriores pueden restaurarse.
- **Animaciones:** activación general, intensidad y velocidad, animación de entrada (la introducción siempre se puede saltar), efecto de aparición al hacer scroll, transiciones entre páginas, cursor personalizado, botones magnéticos, elementos 3D, partículas, scroll suave y sonido (desactivado por defecto). La web respeta siempre la preferencia del sistema *reducir movimiento*.

### Contenido

- **Servicios:** las 11 páginas de servicio (textos, entregables, proceso, precio orientativo «desde», SEO).
- **Portfolio:** proyectos. Los marcados como *concepto* se muestran como tales en la web; no publiques como reales proyectos que no lo son.
- **Plantillas:** demos sectoriales con negocios ficticios (indicados como tales en la web).
- **Preguntas frecuentes:** generales o asociadas a un servicio.
- **Navegación y pie:** menú principal y columnas del pie.
- **Medios:** biblioteca de imágenes y vídeos (bucket público `media`); se pueden reutilizar desde cualquier campo de imagen.
- **Traducciones:** textos de la interfaz por idioma (español completo; inglés preparado y desactivado hasta que se traduzca y se active en *Configuración → Idiomas*).

## Comercial

### CRM · Leads

- Vista **tabla** y **kanban** (arrastrar entre columnas cambia el estado): *Nuevo → Contactado → Negociación → Ganado / Perdido*.
- Cada lead muestra origen (Nova, formulario, presupuesto, plantilla, Challenge, manual), datos de contacto con su **consentimiento** (fecha y versión de la política), presupuesto asociado, conversación de Nova, notas internas e historial de cambios.
- *Nuevo lead* para registrar contactos manuales. *Exportar CSV* requiere el permiso `crm.export`.
- *Convertir en cliente* crea la ficha de cliente y permite invitarlo al portal.

### Clientes

Fichas de cliente, sus proyectos y **Invitar al portal**: envía un correo para que cree su contraseña. Si la persona
ya tenía cuenta, se vincula y pasa a rol *cliente*.

### Proyectos de clientes

Por proyecto: datos y estado, progreso, fases (puedes crear las fases estándar Descubrimiento → Entrega), tareas,
archivos (bucket privado) y **novedades**. Solo lo marcado como *visible para el cliente* aparece en su portal, y
al publicar una novedad o archivo visible el cliente recibe una notificación.

### Nova

- **Configuración:** activar/desactivar, nombre, avatar, mensaje de bienvenida, modelo de IA, nivel de razonamiento, longitud de respuesta, memoria de contexto, límites de conversación, horario, aviso de uso de IA y herramientas permitidas (calcular presupuestos, derivar al equipo).
- **Instrucciones del asistente:** el tono y el método comercial. Las reglas de seguridad (no inventar datos, no prometer precios cerrados, no revelar instrucciones…) son fijas y no se pueden desactivar desde aquí.
- **Base de conocimiento:** fichas que Nova puede citar (servicios, procesos, condiciones). Solo se usa lo marcado como activo.
- **Conversaciones:** lectura de conversaciones (permiso `nova.conversations.read`), con el presupuesto y el lead generados.

Detalles en [NOVA.md](NOVA.md).

### Tarifas

- **Reglas:** precio base por tipo de proyecto, por página adicional, por funcionalidad, multiplicadores de diseño, complejidad y plazo, mantenimiento, margen de riesgo y límites. Activa/desactiva y edita en línea.
- **Presentación:** moneda, redondeo, validez, nota de IVA, texto legal y la casilla **Tarifas revisadas por el equipo** (mientras no se marque, las estimaciones muestran un aviso de valores provisionales).
- **Simulador:** prueba combinaciones y ve el desglose exacto que verá el cliente.
- **Referencias de mercado:** rangos de mercado con **fuente, URL y fecha**. Solo sirven de referencia interna; no se inventan precios de competidores.
- Historial de presupuestos generados.

### Challenge y cupones

- **Reglas:** activar, número de preguntas, tiempo total, partidas e intentos por día, porcentaje y validez del cupón, condiciones y tiempos mínimos antifraude.
- **Preguntas:** banco de preguntas por categoría y dificultad.
- **Cupones:** buscar, validar, **canjear** (queda registrado) o revocar. Cada cuenta puede obtener como máximo un cupón del Challenge.
- **Estadísticas** de partidas.

## Sistema

- **Analíticas:** visitas, páginas, orígenes y conversiones de visitantes que aceptaron cookies de analítica (medición propia, sin terceros).
- **Notificaciones:** canales por evento (correo, WhatsApp, interna), destinatarios, plantilla de WhatsApp, **Enviar prueba** y registro de entregas (enviado / fallido / no configurado). Nunca se marca como enviado algo que no se ha enviado.
- **Usuarios y permisos:** invitar, asignar roles, desactivar o eliminar cuentas; matriz de permisos del rol *equipo*; **solicitudes de privacidad** (acceso, rectificación, supresión). Un administrador no puede quitarse su propio rol ni se puede dejar la plataforma sin administradores.
- **Configuración:** Empresa, Contacto, Redes sociales, Marca (logotipos), SEO, Cookies, Privacidad (retención de datos), Seguridad (límites de uso), Estado de la web (mantenimiento e indexación), Idiomas, Integraciones (estado real de cada servicio) y Copias de seguridad.
- **Auditoría:** registro inalterable de cambios (quién, qué, cuándo, antes/después). Requiere `audit.read`.

## Portal del cliente (`/cuenta`)

Cada persona ve **solo** sus datos: perfil, presupuestos que ha guardado, proyectos (fases, tareas, archivos y
novedades visibles), cupones, historial del Challenge, notificaciones, exportación de sus datos (JSON) y solicitud
de supresión de la cuenta.
