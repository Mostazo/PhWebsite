# Plan de medición y analytics (cookieless)

Este documento resume los eventos mínimos, payloads y la captura en modo cookieless usando `navigator.sendBeacon`.

## Endpoint
- Configura un webhook en Make (Custom webhook) o un endpoint propio.
- Define la URL como variable de entorno `ANALYTICS_WEBHOOK_URL` y asígnala en `app.js` si deseas evitar hardcodeo.

## Función `track`
Ubicación: `app.js`

```js
function track(eventName, payload = {}) {
  const fullPayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (state.analyticsEndpoint) {
    const blob = new Blob([JSON.stringify(fullPayload)], { type: 'application/json' });
    navigator.sendBeacon(state.analyticsEndpoint, blob);
  } else {
    console.info('[track]', fullPayload);
  }
}
```

## Eventos implementados
| Evento | Momento | Payload |
| --- | --- | --- |
| `cta_agendar_click` | Se hace clic en cualquier CTA de agenda (hero, contacto, cards, botón calendario) | `{doctorId, serviceCode, lang}` |
| `whatsapp_click` | Se abre un enlace de WhatsApp | `{doctorId, lang}` |
| `booking_link_shown` | Se muestra la sección con link de agenda para un servicio | `{doctorId, serviceCode, lang}` |
| `payment_click` | Se abre el enlace de pago Stripe/PayPal | `{doctorId, serviceCode, provider, lang}` |

## Captura en Make
1. Crea un **Custom webhook** en Make.
2. Añade un módulo **Google Sheets > Add a row** en hoja `metrics` con columnas:
   - `timestamp` = `payload.timestamp`
   - `event` = `payload.event`
   - `doctorId` = `payload.doctorId`
   - `serviceCode`
   - `lang`
   - `provider`
3. (Opcional) Configura un router para eventos críticos (`payment_click`) para enviar notificaciones.

## Validación manual
- Abre el sitio en modo test, cambia idioma y haz clic en los botones.
- Revisa la consola: si no hay endpoint configurado, se logran los eventos (`[track] { ... }`).
- Con endpoint configurado, inspecciona la pestaña Network → beacon para asegurar envíos.

## Conformidad cookieless
- No se almacenan cookies nuevas. Solo se usa `localStorage` para persistir idioma y doctor.
- Los payloads no incluyen datos personales; se recomienda usar IDs y agregar el teléfono solo del lado de Make cuando se conozca.
