# PROYECTO: Sistema de Atribución Multi-Touch para Altorancho

## Contexto

Soy desarrollador fullstack y responsable técnico único de Altorancho, una empresa de muebles/deco de ~150 personas con dos tiendas en Tienda Nube (mayorista y minorista). Quiero construir un sistema interno de **atribución multi-touch** (customer journey tracking) similar al de elykia.com.ar — un dashboard que muestre, con un diagrama Sankey, el recorrido completo de cada cliente a través de los distintos canales de marketing hasta llegar a la compra final.

Referencia visual del resultado esperado: un Sankey de 5 "toques" (Toque 1 a Toque 5), donde cada columna lista canales (Meta, Google, TikTok, Orgánico, Referral, Email, Directo) con su volumen, y las conexiones fluyen de izquierda a derecha hasta nodos de "Compra" con el % de conversión en cada etapa. El objetivo final es saber qué canales y combinaciones de canales realmente generan ventas, para poder escalar lo que funciona y pausar lo que no — sin estar "apostando" a ciegas con el presupuesto de ads.

## Mi stack actual (usar esto, no introducir alternativas sin justificar)

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Hosting/infra:** Railway (todo el proyecto va acá — backend, base de datos y frontend. NO usar Firebase: Firestore/Cloud Functions quedan descartados por costo)
- **Base de datos:** Postgres (plan managed de Railway). Evaluar al armar el modelo de datos si conviene Postgres puro con SQL o sumar un ORM liviano (Prisma o Drizzle) — decidir esto en el primer paso, no asumir
- **Lenguaje:** TypeScript donde se pueda
- **E-commerce:** Tienda Nube (API REST + sistema de webhooks propio de la plataforma)
- **Ya en producción:** Meta Cloud API (uso esto para un bot de WhatsApp/Instagram en otro cliente, así que ya tengo experiencia con Business Manager / Meta for Developers)
- **Email marketing:** Perfit (tiene Contacts API, Webhooks de eventos — aperturas/clicks/desuscripciones/rebotes —, y Transactional API; documentación en developers.myperfit.com)
- **Deploy:** Railway para todos los servicios (API, worker de procesamiento si hace falta, y el frontend del dashboard)

## Qué quiero construir (alcance v1 — SOLO Altorancho, sus 2 tiendas)

### 1. Captura de toques (frontend tracking script)
Un script JS liviano que se inyecta en las dos tiendas de Tienda Nube (vía script tag personalizado de Tienda Nube) que:
- Genera/persiste un `visitor_id` propio en localStorage + cookie de larga duración (no depender solo de sessionStorage porque el journey cruza sesiones y días)
- En cada page load, parsea la URL y captura:
  - UTMs: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
  - Click IDs de plataformas pagas: `fbclid` (Meta), `gclid` (Google), `ttclid` (TikTok), `epik` (Pinterest)
  - Si no hay ninguno de los anteriores, usar `document.referrer` para inferir canal (orgánico, referral, directo)
- Manda ese evento de "toque" a un endpoint propio (API route en Express, corriendo en Railway) que lo guarda en Postgres asociado al `visitor_id`

### 2. Modelo de datos en Postgres (Railway)
Diseñar el esquema de tablas para:
- `visitors` → `id, created_at`, metadata del visitante
- `touches` → `id, visitor_id (FK), canal, sub_canal (campaña/medium), timestamp, raw_params (jsonb)`
- `conversions` → `id, order_id, visitor_id (FK nullable), email (para matchear cuando no hay visitor_id), monto, fecha`
- Definir índices pensando en las queries que vamos a necesitar para armar las secuencias del Sankey (agrupar por visitor_id, ordenar por timestamp, traer hasta N toques antes de cada conversión)
- Decidir Prisma/Drizzle vs SQL directo en este paso

### 3. Webhook de conversión — Tienda Nube
- Suscribirse al webhook de "order/created" o "order/paid" de la API de Tienda Nube (las dos tiendas)
- Endpoint Express que recibe el webhook, extrae el pedido, y necesita matchear ese pedido con el `visitor_id` que generó la sesión de compra
- **Problema a resolver con el usuario antes de implementar:** Tienda Nube no da control total sobre el checkout nativo. Evaluar opciones: (a) pasar el `visitor_id` como query param hacia el checkout si el theme lo permite, (b) matchear por email/teléfono del comprador contra los emails de contactos que tuvieron toques de Email/Perfit, (c) cualquier otra que surja al investigar la documentación actual de Tienda Nube. Documentarse en la documentación oficial de Tiendanube/Tienda Nube antes de asumir un mecanismo.

### 4. Webhook de eventos — Perfit
- Activar Webhooks de eventos en Perfit (Integraciones > Webhooks) para capturar clicks en emails
- Endpoint Express que reciba esos webhooks, identifique el contacto por email, y registre un "toque" de canal Email en Postgres (matcheando con el visitor si ya existe, o dejando el toque pendiente de matchear por email hasta la conversión)
- Revisar la Contacts API y la API de reportes de Perfit para ver si conviene complementar con polling además del webhook

### 5. Captura de clicks pagos sin pixel adicional
- Confirmar que no se necesita instalar nada nuevo de Meta Ads ni Google Ads — alcanza con capturar `fbclid` y `gclid` de la URL en el script del punto 1
- Documentar (no implementar todavía) cómo se sumarían Pinterest Tag y TikTok Pixel más adelante si se decide correr ads ahí

### 6. Procesamiento y agregación
- Job/función (puede ser un cron de Railway o un script invocado on-demand) que tome todos los `touches` de un `visitor_id` (o `email` cuando no hay visitor_id, ej. journeys que vinieron de email marketing) ordenados por timestamp, y construya la secuencia de canales hasta la conversión
- Agregar esas secuencias en conteos por combinación (Toque 1 → Toque 2 → ... → Compra) para alimentar el Sankey

### 7. Dashboard (frontend)
- Página interna (protegida, no pública) con:
  - El diagrama Sankey multi-toque (usar Plotly.js, que tiene Sankey nativo y es la opción de menor curva de aprendizaje vs. D3 a medida)
  - Filtro de rango de fechas
  - Tabla/resumen de conversión por canal y por combinación de canales
- No necesita ser bonito en v1, necesita ser correcto y leíble

## Lo que NO quiero en esta v1
- Pinterest y TikTok tracking (queda para v2, ya lo charlamos y se documenta el approach pero no se implementa)
- Conversions API de Meta (CAPI) — es para optimizar campañas hacia afuera, no para este dashboard interno
- Multi-tenant / soporte para otros clientes — esto es exclusivamente para Altorancho

## Cómo quiero trabajar
- Empezar por el modelo de datos en Postgres y el endpoint de captura de toques (punto 1 y 2) antes de tocar nada de Tienda Nube o Perfit, para validar el flujo end-to-end con datos de prueba
- Después sumar el webhook de conversión de Tienda Nube
- Después el webhook de Perfit
- Recién al final el dashboard con el Sankey
- Ir preguntándome decisiones de diseño cuando haya ambigüedad (ej. ventana de atribución, qué hacer si un visitor_id tiene 50 toques en vez de 5, qué pasa con conversiones que no matchean ningún toque) en vez de asumir — prefiero iterar rápido y dar feedback concreto en cada paso
- Sé honesto si algo de lo que pido no es viable tal como lo planteo (por ejemplo si Tienda Nube efectivamente no permite pasar el visitor_id al checkout) y proponé alternativas, no fuerces una solución frágil
