# Webhook de pago exitoso (Stripe → Make)

## Objetivo
Recibir notificaciones `checkout.session.completed` desde Stripe, registrar el pago y enviar confirmación por WhatsApp con el enlace de agenda correspondiente.

## Pasos
1. **Crear endpoint en Make**
   - Módulo: *Webhooks > Custom webhook* (ej. `stripe_payment_succeeded`).
   - Copia la URL que genera Make.

2. **Configurar webhook en Stripe**
   - Dashboard → Developers → Webhooks → `+ Add endpoint`.
   - Endpoint URL: la URL del webhook de Make.
   - Eventos a enviar: `checkout.session.completed`.
   - Define el endpoint en modo test y productivo.

3. **Estructura esperada**
   Stripe enviará:
   ```json
   {
     "type": "checkout.session.completed",
     "data": {
       "object": {
         "id": "cs_test_123",
         "customer_details": {
           "email": "user@example.com",
           "phone": "+5491100000000"
         },
         "metadata": {
           "doctorId": "dr-ramirez",
           "serviceCode": "initial"
         }
       }
     }
   }
   ```

4. **Escenario Make**
   - **Step 1:** Webhook (entrada JSON).
   - **Step 2:** Router → validar `type = checkout.session.completed`.
   - **Step 3:** Google Sheets `Update row` en hoja `leads` buscando por teléfono (`customer_details.phone`) o por `id` de sesión.
   - **Step 4:** Google Sheets `Add row` en hoja `metrics` con evento `payment_succeeded`.
   - **Step 5:** Generar mensaje de confirmación:
     - "Gracias por tu pago. Aquí tienes el enlace para agendar con {{doctor.name}}: {{doctor.calendly}}".
   - **Step 6:** WhatsApp → enviar mensaje usando el número `customer_details.phone`.

5. **Reintentos y seguridad**
   - Stripe reintentará automáticamente en caso de fallos; asegúrate de responder `200 OK`.
   - Valida la firma del webhook usando `STRIPE_WEBHOOK_SECRET` si usas funciones serverless. En Make, puedes añadir un filtro que compare `header[Stripe-Signature]` con el secreto (usa módulo de herramientas > función para validar).

6. **Pruebas**
   - Ejecuta `stripe trigger checkout.session.completed` (CLI) apuntando al endpoint público (usando `stripe listen` + `forward-to`).
   - Verifica que Make recibe el evento, actualiza Sheets y envía WhatsApp.

7. **Fallback**
   - Si no hay `metadata.doctorId`, usar el doctor por defecto.
   - Si falta `phone`, enviar email manual (usa `customer_details.email`).
