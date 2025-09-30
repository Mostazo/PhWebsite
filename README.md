# Psychiatry MVP

Sitio estático para consultas de psiquiatría online con soporte multidisciplinario, pagos y automatizaciones.

## Contenido
- Frontend estático (HTML/CSS/JS) con soporte multilenguaje ES/EN
- Datos de profesionales en `data/doctors.json`
- FAQs bilingües en `data/faq_es.json` y `data/faq_en.json`
- Guías operativas en carpetas `payments/`, `deploy/`, `analytics/` y `webhooks/`
- Prompts para escenarios Make/OpenAI en `prompts/`

Consulta `MAKE_GUIDE.md` para ampliar los escenarios de automatización y `deploy/DEPLOY_GUIDE.md` para despliegue en Netlify/Vercel.

## Publicación rápida

- **Vista previa local:**
  ```bash
  python3 -m http.server 4173
  ```
  Luego abre `http://localhost:4173` en tu navegador para revisar la interfaz multilenguaje y los enlaces dinámicos.
- **Netlify:** el archivo `netlify.toml` ya deja configurado el directorio de publicación y cabeceras CORS para `data/` y `prompts/`. Solo conecta el repositorio y despliega.
- **Vercel:** utiliza `vercel.json` incluido para mantener las rutas públicas y cabeceras necesarias.

Una vez desplegado, actualiza el valor `PUBLIC_BASE_URL` en Make y los links de pago en las variables de entorno correspondientes.

## Portal para profesionales

- Cada doctor cuenta con un **código de edición** definido en `data/doctors.json` (`edit_token`).
- Desde el sitio, haz clic en **“Portal profesionales”** para abrir el panel.
- Selecciona el nombre del profesional, ingresa el código y podrás actualizar:
  - Nombre y biografías (ES/EN).
  - Enlaces de Calendly y WhatsApp.
  - Imagen de perfil (se almacena de forma local en el navegador del profesional).
  - Etiquetas, descripciones y tarifas de cada servicio.
- Los cambios se guardan en `localStorage` del dispositivo del doctor; comparte el navegador o exporta `localStorage` si deseas replicarlos en otro equipo.
