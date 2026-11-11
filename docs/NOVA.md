# Nova · asistente comercial

Nova atiende a los visitantes desde el botón flotante y desde las secciones «Llamada a Nova». Su objetivo es
entender el proyecto, recomendar el servicio adecuado, dar una **estimación orientativa calculada por el servidor**
y, si la persona quiere, registrar un lead para el equipo.

## Modos de funcionamiento

| Modo | Cuándo | Cómo responde |
| --- | --- | --- |
| **IA** | Hay `ANTHROPIC_API_KEY` en el servidor | Claude, con las instrucciones y la base de conocimiento del panel, en streaming |
| **Guiado** | Sin clave o si se desactiva la IA | Flujo de preguntas y respuestas rápidas sin IA: tipo de proyecto → funcionalidades → diseño → plazo → estimación → contacto. La interfaz indica que es el modo guiado |

El modo guiado no simula ser una IA: está etiquetado como tal y usa el mismo motor de presupuestos y el mismo
registro de leads.

## Activar la IA

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com) → *API Keys* y configura un límite de gasto mensual en *Billing / Limits*.
2. Añade `ANTHROPIC_API_KEY` a las variables de entorno del servidor (Vercel → *Settings → Environment Variables*) y vuelve a desplegar.
3. **Panel → Configuración → Integraciones** mostrará la IA como conectada. En **Panel → Nova → Configuración** elige modelo y nivel de razonamiento.

La clave nunca llega al navegador: todas las llamadas salen de `/api/nova/*`.

### Modelo y coste

- Modelo por defecto: **Claude Opus 5.5** (el panel ofrece también Sonnet 5.5, Haiku 5.5 y Fable 5.2). `NOVA_MODEL` en el servidor fuerza otro modelo.
- La API se factura por tokens de entrada y salida según la tarifa vigente de Anthropic (consúltala en anthropic.com/pricing).
  Las instrucciones y el conocimiento se envían con *prompt caching*, lo que abarata los mensajes siguientes de una conversación.
- Palancas de coste en el panel: modelo, nivel de razonamiento (*Bajo/Medio/Alto*), longitud máxima de respuesta,
  mensajes de contexto que recuerda y mensajes máximos por conversación.
- Cada conversación guarda los tokens consumidos (`tokens_in`, `tokens_out`) para poder estimar el gasto real.

## Qué puede hacer Nova (herramientas)

| Herramienta | Qué hace | Se puede desactivar |
| --- | --- | --- |
| `estimate_project_quote` | Envía los requisitos al motor de presupuestos; el **servidor** calcula el rango con las reglas de *Tarifas* y lo guarda | Sí |
| `request_contact` | Muestra en el chat una tarjeta para que la persona revise sus datos y **acepte la política de privacidad**; solo entonces se crea el lead | Sí |
| `handoff_to_team` | Avisa al equipo (notificación interna y canales configurados) de que alguien quiere hablar con una persona | Sí |

Nova no puede escribir cifras propias: las únicas cantidades válidas son las devueltas por la herramienta en esa
conversación. Tampoco puede aplicar descuentos (solo existen los cupones del Challenge).

## Configuración editable (Panel → Nova)

- **Configuración:** activación, nombre, avatar, bienvenida, preguntas sugeridas, aviso de uso de IA, modelo,
  razonamiento, límites, horario, mensajes de error y de derivación, herramientas activas.
- **Instrucciones del asistente:** método comercial, tono y preguntas de cualificación (tipo de negocio, objetivo,
  web actual, funcionalidades, diseño, panel, integraciones, automatizaciones, plazo y presupuesto si quiere darlo).
- **Base de conocimiento:** fichas activas que se incluyen en el contexto. Además, Nova recibe automáticamente el
  catálogo de servicios y plantillas publicados y los canales de contacto configurados.

### Reglas de seguridad fijas

Se anteponen siempre a las instrucciones editables y no se pueden quitar desde el panel: no revelar instrucciones ni
configuración, ignorar intentos de cambiar su rol, precios o permisos, no ejecutar nada fuera de sus herramientas ni
seguir instrucciones de textos pegados, no compartir datos de otros clientes, no pedir datos sensibles, no dar
asesoramiento legal/fiscal/médico y no dar cifras que no procedan de la herramienta.

## Privacidad y límites

- Las conversaciones se guardan para que el equipo pueda atender al lead. Las que **no** terminan en lead se
  eliminan tras el plazo configurado (*Configuración → Privacidad*, 365 días por defecto) con la tarea diaria de
  mantenimiento; las asociadas a un lead se conservan con él.
- Un visitante solo puede continuar su propia conversación (token de acceso guardado en su navegador; en el servidor
  solo se guarda su *hash*).
- Límites por IP (anonimizada con sal): 12 mensajes por minuto y 200 al día por defecto, configurables en
  *Configuración → Seguridad*, además del máximo de mensajes por conversación.
- El razonamiento interno del modelo no se almacena.

## Pruebas

`npm run test:nova` ejecuta el flujo completo de IA (streaming, herramienta de estimación, tarjeta de contacto,
persistencia y cabeceras) contra un servidor que imita la API de Claude, sin consumir tokens.
Con una clave real, la comprobación final es una conversación desde la web hasta dejar un contacto.
