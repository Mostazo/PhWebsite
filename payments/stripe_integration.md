# Integración de Stripe Checkout

Esta guía describe dos opciones para habilitar pagos antes del agendamiento. Se recomienda iniciar con Payment Links (opción A) y escalar luego a sesiones de Checkout serverless (opción B).

## Prerrequisitos
- Cuenta de Stripe en modo test (https://dashboard.stripe.com/test/dashboard)
- Productos o precios configurados para cada servicio/doctor
- Webhook de pago conectado a Make (ver `webhooks/README.md`)

## Opción A: Payment Links (sin backend)
1. Inicia sesión en el dashboard de Stripe (modo test).
2. Crea un **Product** por cada servicio. Ejemplo: `Consulta inicial - Dra. Ramírez`.
3. Dentro del producto, crea un **Price** en USD (o la moneda deseada). Activa "More options" para permitir cantidad = 1.
4. En el producto, utiliza la opción **Payment Links** para generar un link permanente.
5. Copia el enlace generado y actualiza `data/doctors.json` en `payment_links.<service>.stripe`.
6. (Opcional) Activa el campo "Collect phone number" y "Custom fields" para capturar `doctorId` y `serviceCode` como metadata:
   - Custom field key: `doctorId`, valor por defecto = ID del doctor.
   - Custom field key: `serviceCode`, valor por defecto = código del servicio.
7. Repite para cada servicio/doctor.
8. Verifica que el botón "Pagar y agendar" del sitio abra el link correcto.

### Flujo de usuario
- El paciente selecciona doctor y servicio → botón "Pagar y agendar" → Payment Link de Stripe.
- Tras completar el pago, Stripe envía un evento `checkout.session.completed` → Make Webhook.
- El escenario Make envía mensaje de confirmación por WhatsApp + link de calendario.

## Opción B: Checkout Sessions con función serverless
1. Crear un endpoint serverless (Netlify Function o Vercel Function) `/api/checkout`.
2. La función recibe `{doctorId, serviceCode, phone}` y crea una `Checkout Session` usando la API de Stripe.
3. Configura la función con las variables de entorno:
   - `STRIPE_SECRET_KEY`
   - `SUCCESS_URL` (ej. `https://tu-dominio.com/confirmacion?session_id={CHECKOUT_SESSION_ID}`)
   - `CANCEL_URL`
4. Define `line_items` según `doctorId` y `serviceCode` (puedes mapearlos a `price` IDs en variables de entorno).
5. Añade `metadata`:
   ```json
   {
     "doctorId": "dr-ramirez",
     "serviceCode": "initial",
     "phone": "+5491100000000"
   }
   ```
6. Devuelve `session.url` al frontend para redirigir al usuario.
7. En el frontend, reemplaza el href del botón "Pagar y agendar" por un `fetch('/api/checkout')` y redirección `window.location = session.url`.
8. Mantén el webhook configurado para capturar `checkout.session.completed`.

## Pruebas recomendadas
- Usa tarjetas de prueba de Stripe (ej. `4242 4242 4242 4242` con cualquier fecha futura y CVC 123).
- Verifica que la metadata llega al webhook de Make.
- Simula un pago fallido para validar mensajes de error.

## PayPal (preparado)
- Puedes habilitar PayPal Smart Buttons incrustando el script oficial y renderizando botones en un modal.
- Mantén `paymentConfig.paypalEnabled = true` y define `payment_links.<service>.paypal`.
- Reemplaza el botón "Pagar y agendar" por el contenedor de PayPal si se habilita.
- Documenta la URL del webhook de PayPal (IPN o Webhook v2) y conéctala a Make para notificar pagos exitosos.

## Checklist de activación
- [ ] Payment Links creados y probados en modo test
- [ ] Metadata capturando `doctorId`, `serviceCode`, `phone`
- [ ] Webhook `checkout.session.completed` apuntando a Make
- [ ] Respuesta de Make con mensaje de confirmación + enlace de agenda
- [ ] Documentación de cambio a modo live (solo actualizar claves y links)
