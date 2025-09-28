const state = {
  lang: 'es',
  doctors: [],
  i18n: {},
  faq: { es: [], en: [] },
  selectedDoctorId: null,
  selectedServiceCode: null,
  analyticsEndpoint: '',
  bookingShownTracker: new Set(),
};

const paymentConfig = {
  stripeEnabled: true,
  paypalEnabled: false,
};

async function fetchJSON(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`No se pudo cargar ${path}`);
  }
  return response.json();
}

function initLang() {
  const saved = localStorage.getItem('lang');
  if (saved && ['es', 'en'].includes(saved)) {
    state.lang = saved;
    document.documentElement.lang = saved;
  }
  applyActiveLangBtn();
}

function setLang(lang) {
  if (!['es', 'en'].includes(lang)) return;
  state.lang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  applyActiveLangBtn();
  renderTranslations();
  renderDoctors();
  renderDoctorSelect();
  renderServices();
  renderFaq();
  syncSelections();
}

function applyActiveLangBtn() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === state.lang);
  });
}

function t(key) {
  return state.i18n?.[state.lang]?.[key] ?? key;
}

function renderTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const translation = t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.setAttribute('placeholder', translation);
    } else if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'OPTION' || el.hasAttribute('data-i18n-html')) {
      el.textContent = translation;
    } else {
      el.textContent = translation;
    }
  });
}

function formatPrices(service) {
  const currencyTexts = {
    es: `USD $${service.usd} · EUR €${service.eur}`,
    en: `USD $${service.usd} · EUR €${service.eur}`,
  };
  return currencyTexts[state.lang];
}

function renderDoctors() {
  const container = document.getElementById('doctors-list');
  if (!container) return;
  container.innerHTML = '';

  state.doctors.forEach((doctor) => {
    const card = document.createElement('article');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = doctor.name;

    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = doctor.meet_provider === 'zoom' ? t('doctors.zoom') : t('doctors.google');

    const bio = document.createElement('p');
    bio.textContent = state.lang === 'es' ? doctor.bio_es : doctor.bio_en;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const calendarLink = document.createElement('a');
    calendarLink.href = doctor.calendly;
    calendarLink.className = 'primary-btn';
    calendarLink.target = '_blank';
    calendarLink.rel = 'noopener';
    calendarLink.textContent = t('doctors.viewSchedule');
    calendarLink.addEventListener('click', () => {
      state.selectedDoctorId = doctor.id;
      persistSelectedDoctor();
      track('cta_agendar_click', {
        doctorId: doctor.id,
        serviceCode: state.selectedServiceCode,
        lang: state.lang,
      });
      syncSelections();
    });

    const whatsappLink = document.createElement('a');
    whatsappLink.href = doctor.whatsapp;
    whatsappLink.className = 'secondary-btn';
    whatsappLink.target = '_blank';
    whatsappLink.rel = 'noopener';
    whatsappLink.textContent = t('doctors.writeWhatsapp');
    whatsappLink.addEventListener('click', () => {
      track('whatsapp_click', {
        doctorId: doctor.id,
        lang: state.lang,
      });
    });

    actions.append(calendarLink, whatsappLink);
    card.append(title, badge, bio, actions);
    container.append(card);
  });
}

function renderDoctorSelect() {
  const select = document.getElementById('doctor-select');
  if (!select) return;
  select.innerHTML = '';

  state.doctors.forEach((doctor) => {
    const option = document.createElement('option');
    option.value = doctor.id;
    option.textContent = `${doctor.name}`;
    if (state.selectedDoctorId === doctor.id) {
      option.selected = true;
    }
    select.appendChild(option);
  });

  if (!state.selectedDoctorId && state.doctors.length) {
    state.selectedDoctorId = state.doctors[0].id;
  }

  select.onchange = (event) => {
    state.selectedDoctorId = event.target.value;
    persistSelectedDoctor();
    state.selectedServiceCode = null;
    renderServices();
    syncSelections();
  };
}

function renderServices() {
  const container = document.getElementById('services-list');
  const ctaArea = document.getElementById('cta-area');
  if (!container || !ctaArea) return;

  container.innerHTML = '';
  ctaArea.hidden = true;

  const doctor = state.doctors.find((d) => d.id === state.selectedDoctorId);
  if (!doctor) {
    return;
  }

  doctor.services.forEach((service) => {
    const card = document.createElement('div');
    card.className = 'service-card';

    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.textContent = state.lang === 'es' ? service.label_es : service.label_en;

    const selectBtn = document.createElement('button');
    selectBtn.className = 'primary-btn';
    selectBtn.textContent = t('fees.selectService');
    selectBtn.addEventListener('click', () => {
      state.selectedServiceCode = service.code;
      renderCtaArea(doctor, service);
      syncSelections();
    });

    header.append(title, selectBtn);

    const prices = document.createElement('p');
    prices.className = 'service-prices';
    prices.textContent = formatPrices(service);

    const description = document.createElement('p');
    description.textContent = state.lang === 'es' ? service.description_es : service.description_en;

    card.append(header, prices, description);
    container.append(card);
  });

  if (state.selectedServiceCode) {
    const selectedService = doctor.services.find((s) => s.code === state.selectedServiceCode);
    if (selectedService) {
      renderCtaArea(doctor, selectedService);
    }
  }
}

function renderCtaArea(doctor, service) {
  const ctaArea = document.getElementById('cta-area');
  const ctaTitle = document.getElementById('cta-service-title');
  const ctaPrices = document.getElementById('cta-service-prices');
  const ctaPayment = document.getElementById('cta-payment');
  const ctaBooking = document.getElementById('cta-booking');
  const ctaNote = document.getElementById('cta-payment-note');

  if (!ctaArea) return;

  ctaArea.hidden = false;
  ctaTitle.textContent = state.lang === 'es' ? service.label_es : service.label_en;
  ctaPrices.textContent = formatPrices(service);

  const paymentLink = doctor.payment_links?.[service.code]?.stripe ?? null;
  const paypalLink = doctor.payment_links?.[service.code]?.paypal ?? null;

  if (paymentConfig.stripeEnabled && paymentLink) {
    ctaPayment.href = paymentLink;
    ctaPayment.style.display = 'inline-flex';
    ctaPayment.onclick = () => {
      track('payment_click', {
        doctorId: doctor.id,
        serviceCode: service.code,
        provider: 'stripe',
        lang: state.lang,
      });
    };
    ctaNote.textContent = state.lang === 'es'
      ? 'Serás redirigido a Stripe Checkout en modo seguro. Tras el pago, recibirás el enlace para agendar.'
      : 'You will be redirected to a secure Stripe Checkout page. After payment you will receive the scheduling link.';
  } else if (paymentConfig.paypalEnabled && paypalLink) {
    ctaPayment.href = paypalLink;
    ctaPayment.style.display = 'inline-flex';
    ctaPayment.onclick = () => {
      track('payment_click', {
        doctorId: doctor.id,
        serviceCode: service.code,
        provider: 'paypal',
        lang: state.lang,
      });
    };
    ctaNote.textContent = state.lang === 'es'
      ? 'El pago se realizará con PayPal. Tras confirmar recibirás instrucciones para agendar.'
      : 'Payment will be processed via PayPal. After confirmation you will receive scheduling instructions.';
  } else {
    ctaPayment.removeAttribute('href');
    ctaPayment.style.display = 'none';
    ctaPayment.onclick = null;
    ctaNote.textContent = state.lang === 'es'
      ? 'Próximamente habilitaremos pagos en línea para este servicio.'
      : 'Online payments for this service will be available soon.';
  }

  ctaBooking.href = doctor.calendly;
  ctaBooking.onclick = () => {
    track('cta_agendar_click', {
      doctorId: doctor.id,
      serviceCode: service.code,
      lang: state.lang,
    });
  };

  const bookingKey = `${doctor.id}-${service.code}`;
  if (!state.bookingShownTracker.has(bookingKey)) {
    state.bookingShownTracker.add(bookingKey);
    track('booking_link_shown', {
      doctorId: doctor.id,
      serviceCode: service.code,
      lang: state.lang,
    });
  }
}

function renderFaq() {
  const container = document.getElementById('faq-list');
  if (!container) return;
  container.innerHTML = '';
  const items = state.faq[state.lang] || [];

  items.forEach((item) => {
    const wrapper = document.createElement('article');
    wrapper.className = 'faq-item';

    const title = document.createElement('h3');
    title.textContent = item.question;
    const body = document.createElement('p');
    body.textContent = item.answer;

    wrapper.append(title, body);
    container.append(wrapper);
  });
}

function persistSelectedDoctor() {
  if (state.selectedDoctorId) {
    localStorage.setItem('selectedDoctorId', state.selectedDoctorId);
  }
}

function restoreSelections() {
  const savedDoctor = localStorage.getItem('selectedDoctorId');
  if (savedDoctor) {
    state.selectedDoctorId = savedDoctor;
  }
}

function syncSelections() {
  const doctor = state.doctors.find((d) => d.id === state.selectedDoctorId) || state.doctors[0];
  if (!doctor) return;
  const service = doctor.services.find((s) => s.code === state.selectedServiceCode);

  const contactCta = document.getElementById('contact-cta');
  const contactWhatsapp = document.getElementById('contact-whatsapp');
  const heroCta = document.getElementById('hero-cta');
  const heroWhatsapp = document.getElementById('hero-whatsapp');

  if (contactCta) {
    contactCta.onclick = () => {
      track('cta_agendar_click', {
        doctorId: doctor.id,
        serviceCode: service?.code || null,
        lang: state.lang,
      });
      window.open(doctor.calendly, '_blank');
    };
  }

  if (heroCta) {
    heroCta.onclick = () => {
      track('cta_agendar_click', {
        doctorId: doctor.id,
        serviceCode: service?.code || null,
        lang: state.lang,
      });
      window.open(doctor.calendly, '_blank');
    };
  }

  if (contactWhatsapp) {
    contactWhatsapp.href = doctor.whatsapp;
    contactWhatsapp.onclick = () => {
      track('whatsapp_click', {
        doctorId: doctor.id,
        lang: state.lang,
      });
    };
  }

  if (heroWhatsapp) {
    heroWhatsapp.href = doctor.whatsapp;
    heroWhatsapp.onclick = () => {
      track('whatsapp_click', {
        doctorId: doctor.id,
        lang: state.lang,
      });
    };
  }
}

function track(eventName, payload = {}) {
  const fullPayload = {
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  if (state.analyticsEndpoint) {
    try {
      const body = JSON.stringify(fullPayload);
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(state.analyticsEndpoint, blob);
      } else {
        fetch(state.analyticsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch((error) => {
          console.warn('Fetch beacon error, logging to console', error, fullPayload);
        });
      }
    } catch (error) {
      console.warn('Beacon error, logging to console', error, fullPayload);
    }
  } else {
    console.info('[track]', fullPayload);
  }
}

function initPaymentConfig() {
  const dataset = document.body?.dataset || {};
  if (typeof dataset.stripeEnabled !== 'undefined') {
    paymentConfig.stripeEnabled = dataset.stripeEnabled !== 'false';
  }
  if (typeof dataset.paypalEnabled !== 'undefined') {
    paymentConfig.paypalEnabled = dataset.paypalEnabled === 'true';
  }
}

async function init() {
  try {
    initLang();
    restoreSelections();
    state.analyticsEndpoint = document.body?.dataset?.analyticsEndpoint || '';
    initPaymentConfig();

    const [i18n, doctorsData, faqEs, faqEn] = await Promise.all([
      fetchJSON('data/i18n.json'),
      fetchJSON('data/doctors.json'),
      fetchJSON('data/faq_es.json'),
      fetchJSON('data/faq_en.json'),
    ]);

    state.i18n = i18n;
    state.doctors = doctorsData.doctors;
    state.faq.es = faqEs.faq;
    state.faq.en = faqEn.faq;

    renderTranslations();
    renderDoctors();
    renderDoctorSelect();
    renderServices();
    renderFaq();
    syncSelections();

    document.getElementById('current-year').textContent = new Date().getFullYear();

    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
  } catch (error) {
    console.error('Error inicializando la aplicación', error);
    const container = document.querySelector('main');
    if (container) {
      container.innerHTML = `<section class="section"><div class="container"><h2>Se produjo un error</h2><p>${error.message}</p></div></section>`;
    }
  }
}

init();
