# Guía de despliegue (Netlify & Vercel)

Este proyecto es estático. Puedes desplegarlo en Netlify o Vercel en pocos pasos.

## Variables de entorno comunes
- `PUBLIC_BASE_URL`: URL pública del sitio (ej. `https://psychiatry-care.netlify.app`)
- `ANALYTICS_WEBHOOK_URL`: URL del webhook Make para `navigator.sendBeacon` (opcional)
- `STRIPE_PAYMENTLINK_<DOCTORID>_<SERVICE>`: URLs de pago si deseas manejarlas como variables (opcional)

### Netlify
1. **Repositorio:** Conecta el repo a Netlify y selecciona la rama principal.
2. **Build settings:**
   - Build command: `npm run build` (no aplica, deja vacío) o "None".
   - Publish directory: `/` (raíz).
3. **Environment variables:**
   - En el panel "Site settings" → "Build & deploy" → "Environment" agrega las variables listadas arriba.
4. **Headers (opcional):** Usa `_headers` si necesitas políticas específicas de seguridad.
5. **Funciones serverless:** Si usas la opción B de Stripe, añade una función en `netlify/functions/checkout.js` y configura `build.command` para compilar (`npm install && npm run build`).
6. **Preview:** Ejecuta un deploy manual y valida que `index.html` carga datos (Netlify sirve archivos JSON correctamente).

### Vercel
1. **Proyecto:** Importa el repo desde GitHub.
2. **Framework preset:** Selecciona "Other".
3. **Build & Output settings:**
   - Build command: dejar vacío.
   - Output directory: `.`
   - En "Advanced" marca "Output is a static site".
4. **Environment variables:** Agrega las variables igual que en Netlify.
5. **Serverless functions:** Para Stripe Checkout avanzado, crea `/api/checkout.js` y habilita Node.js 18.
6. **Rewrites (opcional):** Si necesitas redirigir `/pay/:doctor/:service` hacia Payment Links, usa `vercel.json`.

### Post-despliegue
- Actualiza `PUBLIC_BASE_URL` en Make para consumir los JSON.
- Verifica que `navigator.sendBeacon` funciona (se puede revisar en la pestaña Network → beacon).
- Configura el dominio personalizado y certificados TLS.
- Ejecuta los casos de prueba de QA (ver `QA_CHECKLIST.md`).
