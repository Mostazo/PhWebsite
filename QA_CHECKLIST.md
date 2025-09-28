# QA Checklist & Casos de prueba

## Casos funcionales
1. **Cambio de idioma**
   - Acciones: Cambiar a EN, refrescar página, validar textos en inglés y persistencia.
   - Resultado esperado: Idioma persiste y textos traducidos.
2. **Selección de doctor**
   - Acciones: Elegir Dr. Velasco en dropdown y en cards, verificar CTA y WhatsApp apuntan a su enlace.
   - Resultado esperado: Enlaces actualizados y evento `cta_agendar_click` en consola.
3. **Selección de servicio**
   - Acciones: Seleccionar servicio "Consulta inicial" → ver CTA y nota de pago.
   - Resultado esperado: Aparece botón Stripe con link correcto, se registra `booking_link_shown`.
4. **Pago**
   - Acciones: Hacer clic en "Pagar y agendar".
   - Resultado esperado: Redirección a Payment Link y evento `payment_click` con provider `stripe`.
5. **WhatsApp**
   - Acciones: Click en botón hero/contacto.
   - Resultado esperado: Abre enlace de WhatsApp del doctor y evento `whatsapp_click` en consola.
6. **FAQs**
   - Acciones: Cambiar idioma y verificar FAQ.
   - Resultado esperado: Preguntas y respuestas actualizadas según idioma.
7. **Persistencia**
   - Acciones: Seleccionar doctor + servicio, recargar.
   - Resultado esperado: Doctor seleccionado se mantiene, servicio se limpia.
8. **Analytics sin endpoint**
   - Acciones: Quitar `analyticsEndpoint`, interactuar.
   - Resultado esperado: Consola muestra `[track]` sin errores.
9. **Carga de datos**
   - Acciones: Simular error renombrando `doctors.json`.
   - Resultado esperado: Mensaje de error legible en UI.
10. **Accesibilidad básica**
   - Acciones: Navegar con teclado.
   - Resultado esperado: Botones y enlaces enfocables.

## Checklist de publicación
- [ ] Validar enlaces de Calendly y WhatsApp por doctor.
- [ ] Confirmar Payment Links actualizados (modo test/live).
- [ ] Revisar traducciones con especialista bilingüe.
- [ ] Configurar `ANALYTICS_WEBHOOK_URL` en producción.
- [ ] Ejecutar pruebas de automatización en Make (clasificador, booking, webhook pago).
- [ ] Documentar credenciales en gestor seguro.

## Auto-verificación del equipo
- [ ] README y guías actualizadas.
- [ ] Código pasa validación de W3C (HTML/CSS).
- [ ] Revisar consola del navegador (sin errores).
- [ ] Confirmar persistencia de idioma en localStorage.
- [ ] Probar en mobile viewport (Chrome DevTools).
- [ ] Validar que PayPal está documentado pero desactivado por defecto.
- [ ] Confirmar prompts contienen instrucciones exactas del requerimiento.
- [ ] Asegurar `track()` se invoca en todos los eventos requeridos.
- [ ] Chequear que `doctors.json` expone `payment_links` por servicio.
- [ ] Ejecutar los 10 casos funcionales listados arriba.
