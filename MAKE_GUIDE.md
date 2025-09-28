# Guía de automatizaciones Make

Esta guía describe el escenario recomendado para gestionar leads entrantes por WhatsApp, clasificación automática, respuestas con OpenAI, registro en hojas de cálculo y soporte de pagos.

## Resumen del flujo

1. **Trigger:** Webhook de WhatsApp (Twilio Conversations, Meta Cloud API o proveedor equivalente) recibe `{from, body}`.
2. **Carga de contexto:**
   - HTTP GET público a `https://<tu-dominio>/data/doctors.json`.
   - HTTP GET a `https://<tu-dominio>/data/faq_<lang>.json` (usa heurística básica: detectar `hola`, `gracias`, `precio` → español; `hi`, `price`, `thanks` → inglés. Si duda, default español).
3. **Clasificación (OpenAI):**
   - Módulo OpenAI > Create completion/chat usando `prompts/openai_classifier_prompt.txt` como prompt del sistema + plantilla usuario.
   - Variables:
     - `PreguntaCliente` = `body` (mensaje de WhatsApp).
     - `DoctorsJSON` = respuesta del GET de doctores.
     - `ContenidoFAQ` = unión de 3-4 respuestas relevantes del FAQ según idioma detectado.
   - Parsear JSON devuelto `{intent, emergency, lang, doctor_hint}`.
4. **Ramas:**
   - Si `emergency = true`: responder con mensaje de seguridad y finalizar. No guardar información sensible.
   - Si `emergency = false`: continuar.
5. **Lead en Google Sheets:**
   - Hoja `leads` con columnas `timestamp`, `phone`, `lang`, `intent`, `doctorId`, `message`, `reply_sent`.
   - Crear fila con hora actual (Make: `now`), `from`, campos de clasificación y marcar `reply_sent = pending`.
6. **Preparar respuesta:**
   - Determinar `doctor_target`: usar `doctor_hint` si existe y coincide con algún `id`. Si no, usar doctor por defecto (`dr-ramirez`).
   - Si `intent = pricing` o `info`, construir breve resumen (3 ítems) tomando FAQ.
   - Si `intent = booking`, identificar `serviceCode`: por defecto `initial`. Puedes permitir al usuario indicar `seguimiento`, `follow up` usando regex.
7. **Generar respuesta (OpenAI):**
   - Prompt en `prompts/openai_booking_prompt.txt`.
   - Variables:
     - `PreguntaCliente` = mensaje original.
     - `lang` = salida del clasificador.
     - `DoctorsJSON` = doctores.
     - `ContenidoFAQ` = FAQ por idioma.
     - `intent` = intención detectada.
     - `doctor_hint` = `doctor_target`.
     - `serviceCode` = servicio detectado o `initial`.
   - Limitar longitud: 6 líneas máximo.
8. **Respuesta por WhatsApp:**
   - Enviar mensaje final al usuario usando el conector de WhatsApp.
   - Si `intent = booking` y no se requiere pago previo: incluir link `calendly` del doctor y registrar evento (ver sección Métricas).
   - Actualizar fila en Google Sheets (`reply_sent = yes`).
9. **Métricas (Google Sheets):**
   - Hoja `metrics` con columnas `timestamp`, `phone`, `doctorId`, `intent`, `eventName`.
   - Registrar eventos:
     - `booking_link_shown` cuando se envía link de agenda.
     - `payment_link_sent` si se envía link de pago Stripe.
10. **Webhook de pago (ver carpeta webhooks/):**
    - Stripe → Make Webhook.
    - Buscar fila de lead por `phone` (metadata de Stripe) o `session_id`.
    - Enviar mensaje de confirmación por WhatsApp con enlace de agenda correspondiente al doctor/servicio.
    - Registrar en hoja `metrics` el evento `payment_succeeded`.

## Manejo de errores
- Implementa routers para códigos 429/5xx. Reintentar hasta 3 veces con backoff exponencial.
- Validar longitud del mensaje de entrada (`body`). Si > 800 caracteres, resumir antes de enviar a OpenAI.
- Ignorar adjuntos: si el mensaje incluye `attachments`, responder con texto indicando que solo se procesan mensajes escritos.

## Variables de entorno Make
- `OPENAI_API_KEY`
- `GOOGLE_SHEETS_ID`
- `STRIPE_PAYMENT_LINK_DEFAULT` (fallback si no se encuentra link por servicio)
- `DEFAULT_DOCTOR_ID` (ej. `dr-ramirez`)

## Testing sugerido
- Mensaje informativo "Hola, ¿qué opciones tienen?" → espera intención `info`.
- Mensaje de precios "Hi, how much is the first session with Dr. Velasco?" → intención `pricing`, doctor sugerido `dr-velasco`.
- Mensaje de emergencia "Estoy pensando en hacerme daño" → bandera `emergency = true`.
- Mensaje de reserva "Quiero agendar seguimiento con Ramírez" → detectar `followup` y link correspondiente.
