const state = {
  lang: 'es',
  baseDoctors: [],
  doctors: [],
  doctorOverrides: {},
  i18n: {},
  faq: { es: [], en: [] },
  selectedDoctorId: null,
  selectedServiceCode: null,
  analyticsEndpoint: '',
  bookingShownTracker: new Set(),
  admin: {
    activeDoctorId: null,
    pendingImageData: null,
  },
};

const STORAGE_KEYS = {
  doctorOverrides: 'doctorOverrides_v1',
};

const DEFAULT_DOCTOR_IMAGE = 'https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?auto=format&fit=crop&w=800&q=80';

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

function loadDoctorOverrides() {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.doctorOverrides);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('No se pudieron cargar los cambios locales de profesionales', error);
    return {};
  }
}

function saveDoctorOverrides() {
  try {
    localStorage.setItem(STORAGE_KEYS.doctorOverrides, JSON.stringify(state.doctorOverrides));
  } catch (error) {
    console.warn('No se pudieron guardar los cambios locales de profesionales', error);
  }
}

function getDoctorById(id, { useBase = false } = {}) {
  const source = useBase ? state.baseDoctors : state.doctors;
  return source.find((doctor) => doctor.id === id) || null;
}

function mergeDoctorData(baseDoctor, override = {}) {
  if (!baseDoctor) return null;
  const merged = {
    ...baseDoctor,
    services: baseDoctor.services.map((service) => ({ ...service })),
  };

  const editableFields = ['name', 'bio_es', 'bio_en', 'calendly', 'whatsapp', 'image'];
  editableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(override, field)) {
      merged[field] = override[field];
    }
  });

  if (override.services) {
    merged.services = merged.services.map((service) => {
      const serviceOverride = override.services?.[service.code];
      if (!serviceOverride) return service;
      const updated = { ...service };
      ['label_es', 'label_en', 'description_es', 'description_en'].forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(serviceOverride, field)) {
          updated[field] = serviceOverride[field];
        }
      });
      ['usd', 'eur'].forEach((currency) => {
        if (Object.prototype.hasOwnProperty.call(serviceOverride, currency)) {
          const value = Number(serviceOverride[currency]);
          updated[currency] = Number.isNaN(value) ? service[currency] : value;
        }
      });
      return updated;
    });
  }

  return merged;
}

function applyDoctorState() {
  state.doctors = state.baseDoctors.map((doctor) => mergeDoctorData(doctor, state.doctorOverrides[doctor.id]));

  if (!state.selectedDoctorId || !state.doctors.some((doctor) => doctor.id === state.selectedDoctorId)) {
    state.selectedDoctorId = state.doctors[0]?.id || null;
  }

  if (state.selectedServiceCode) {
    const doctor = getDoctorById(state.selectedDoctorId);
    const serviceExists = doctor?.services?.some((service) => service.code === state.selectedServiceCode);
    if (!serviceExists) {
      state.selectedServiceCode = null;
    }
  }
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
  if (state.admin.activeDoctorId) {
    fillDoctorEditForm(state.admin.activeDoctorId);
  }
  populateDoctorLoginSelect();
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
    card.className = 'card doctor-card';

    const imageWrapper = document.createElement('div');
    imageWrapper.className = 'doctor-card__image';
    const image = document.createElement('img');
    image.src = doctor.image || DEFAULT_DOCTOR_IMAGE;
    image.alt = doctor.name;
    image.loading = 'lazy';
    imageWrapper.append(image);

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
    card.append(imageWrapper, title, badge, bio, actions);
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
    description.textContent = state.lang === 'es' ? service.description_es || '' : service.description_en || '';

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

  let noteKey = 'fees.paymentNote.disabled';

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
    noteKey = 'fees.paymentNote.stripe';
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
    noteKey = 'fees.paymentNote.paypal';
  } else {
    ctaPayment.removeAttribute('href');
    ctaPayment.style.display = 'none';
    ctaPayment.onclick = null;
  }

  ctaNote.setAttribute('data-i18n', noteKey);
  ctaNote.textContent = t(noteKey);

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

function populateDoctorLoginSelect() {
  const select = document.getElementById('doctor-login-select');
  if (!select) return;
  select.innerHTML = '';

  state.doctors.forEach((doctor) => {
    const option = document.createElement('option');
    option.value = doctor.id;
    option.textContent = doctor.name;
    select.append(option);
  });

  if (state.admin.activeDoctorId && state.doctors.some((doctor) => doctor.id === state.admin.activeDoctorId)) {
    select.value = state.admin.activeDoctorId;
  }
}

function updateDoctorImagePreview(imageSrc, doctorName = '') {
  const preview = document.getElementById('doctor-image-preview');
  if (!preview) return;
  preview.src = imageSrc || DEFAULT_DOCTOR_IMAGE;
  preview.alt = doctorName || t('admin.imagePlaceholder');
}

function fillDoctorEditForm(doctorId) {
  const doctor = getDoctorById(doctorId);
  if (!doctor) return;

  const nameInput = document.getElementById('doctor-name');
  const bioEsInput = document.getElementById('doctor-bio-es');
  const bioEnInput = document.getElementById('doctor-bio-en');
  const calendlyInput = document.getElementById('doctor-calendly');
  const whatsappInput = document.getElementById('doctor-whatsapp');

  if (nameInput) nameInput.value = doctor.name || '';
  if (bioEsInput) bioEsInput.value = doctor.bio_es || '';
  if (bioEnInput) bioEnInput.value = doctor.bio_en || '';
  if (calendlyInput) calendlyInput.value = doctor.calendly || '';
  if (whatsappInput) whatsappInput.value = doctor.whatsapp || '';

  state.admin.pendingImageData = state.doctorOverrides[doctorId]?.image ?? doctor.image ?? null;
  updateDoctorImagePreview(state.admin.pendingImageData || doctor.image, doctor.name);

  const servicesContainer = document.getElementById('doctor-edit-services');
  if (servicesContainer) {
    servicesContainer.innerHTML = '';
    const baseDoctor = getDoctorById(doctorId, { useBase: true }) || doctor;

    doctor.services.forEach((service) => {
      const baseService = baseDoctor.services.find((item) => item.code === service.code) || service;
      const fieldset = document.createElement('fieldset');
      fieldset.className = 'service-fieldset';
      fieldset.dataset.serviceCode = service.code;

      const legend = document.createElement('legend');
      legend.textContent = `${t('admin.serviceLegend')} · ${service.code}`;
      fieldset.append(legend);

      const labelEs = document.createElement('label');
      labelEs.className = 'form-field';
      const spanEs = document.createElement('span');
      spanEs.setAttribute('data-i18n', 'admin.serviceLabelEs');
      spanEs.textContent = t('admin.serviceLabelEs');
      const inputEs = document.createElement('input');
      inputEs.type = 'text';
      inputEs.name = 'label_es';
      inputEs.value = service.label_es || baseService.label_es || '';
      inputEs.required = true;
      labelEs.append(spanEs, inputEs);
      fieldset.append(labelEs);

      const labelEn = document.createElement('label');
      labelEn.className = 'form-field';
      const spanEn = document.createElement('span');
      spanEn.setAttribute('data-i18n', 'admin.serviceLabelEn');
      spanEn.textContent = t('admin.serviceLabelEn');
      const inputEn = document.createElement('input');
      inputEn.type = 'text';
      inputEn.name = 'label_en';
      inputEn.value = service.label_en || baseService.label_en || '';
      inputEn.required = true;
      labelEn.append(spanEn, inputEn);
      fieldset.append(labelEn);

      const descriptionEs = document.createElement('label');
      descriptionEs.className = 'form-field';
      const descEsSpan = document.createElement('span');
      descEsSpan.setAttribute('data-i18n', 'admin.serviceDescriptionEs');
      descEsSpan.textContent = t('admin.serviceDescriptionEs');
      const descEsInput = document.createElement('textarea');
      descEsInput.name = 'description_es';
      descEsInput.rows = 3;
      descEsInput.value = service.description_es || baseService.description_es || '';
      descriptionEs.append(descEsSpan, descEsInput);
      fieldset.append(descriptionEs);

      const descriptionEn = document.createElement('label');
      descriptionEn.className = 'form-field';
      const descEnSpan = document.createElement('span');
      descEnSpan.setAttribute('data-i18n', 'admin.serviceDescriptionEn');
      descEnSpan.textContent = t('admin.serviceDescriptionEn');
      const descEnInput = document.createElement('textarea');
      descEnInput.name = 'description_en';
      descEnInput.rows = 3;
      descEnInput.value = service.description_en || baseService.description_en || '';
      descriptionEn.append(descEnSpan, descEnInput);
      fieldset.append(descriptionEn);

      const priceGrid = document.createElement('div');
      priceGrid.className = 'price-grid';

      const priceUsd = document.createElement('label');
      priceUsd.className = 'form-field';
      const priceUsdSpan = document.createElement('span');
      priceUsdSpan.setAttribute('data-i18n', 'admin.servicePriceUsd');
      priceUsdSpan.textContent = t('admin.servicePriceUsd');
      const priceUsdInput = document.createElement('input');
      priceUsdInput.type = 'number';
      priceUsdInput.name = 'usd';
      priceUsdInput.step = '0.01';
      priceUsdInput.min = '0';
      priceUsdInput.value = service.usd ?? baseService.usd ?? '';
      priceUsd.append(priceUsdSpan, priceUsdInput);

      const priceEur = document.createElement('label');
      priceEur.className = 'form-field';
      const priceEurSpan = document.createElement('span');
      priceEurSpan.setAttribute('data-i18n', 'admin.servicePriceEur');
      priceEurSpan.textContent = t('admin.servicePriceEur');
      const priceEurInput = document.createElement('input');
      priceEurInput.type = 'number';
      priceEurInput.name = 'eur';
      priceEurInput.step = '0.01';
      priceEurInput.min = '0';
      priceEurInput.value = service.eur ?? baseService.eur ?? '';
      priceEur.append(priceEurSpan, priceEurInput);

      priceGrid.append(priceUsd, priceEur);
      fieldset.append(priceGrid);

      servicesContainer.append(fieldset);
    });
  }

  renderTranslations();
}

function handleDoctorLogin(event) {
  event.preventDefault();
  const doctorId = document.getElementById('doctor-login-select')?.value;
  const code = document.getElementById('doctor-login-code')?.value?.trim();
  const errorEl = document.getElementById('doctor-login-error');

  if (!doctorId || !code) {
    if (errorEl) errorEl.textContent = t('admin.loginErrorInvalid');
    return;
  }

  const baseDoctor = getDoctorById(doctorId, { useBase: true });
  if (!baseDoctor || baseDoctor.edit_token !== code) {
    if (errorEl) errorEl.textContent = t('admin.loginErrorInvalid');
    return;
  }

  state.admin.activeDoctorId = doctorId;
  if (errorEl) errorEl.textContent = '';

  const codeInput = document.getElementById('doctor-login-code');
  if (codeInput) codeInput.value = '';

  const loginSection = document.getElementById('doctor-login-section');
  const editSection = document.getElementById('doctor-edit-section');
  if (loginSection) loginSection.hidden = true;
  if (editSection) editSection.hidden = false;

  fillDoctorEditForm(doctorId);

  const nameInput = document.getElementById('doctor-name');
  nameInput?.focus();
}

function handleDoctorLogout() {
  state.admin.activeDoctorId = null;
  state.admin.pendingImageData = null;

  const loginSection = document.getElementById('doctor-login-section');
  const editSection = document.getElementById('doctor-edit-section');
  if (loginSection) loginSection.hidden = false;
  if (editSection) editSection.hidden = true;

  document.getElementById('doctor-login-form')?.reset();
  const status = document.getElementById('doctor-save-status');
  if (status) status.textContent = '';
  populateDoctorLoginSelect();
}

function handleDoctorImageChange(event) {
  const file = event.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    state.admin.pendingImageData = loadEvent.target?.result || null;
    const doctor = getDoctorById(state.admin.activeDoctorId);
    updateDoctorImagePreview(state.admin.pendingImageData, doctor?.name || '');
  };
  reader.readAsDataURL(file);
}

function handleDoctorImageRemove() {
  state.admin.pendingImageData = null;
  const doctor = getDoctorById(state.admin.activeDoctorId);
  updateDoctorImagePreview(null, doctor?.name || '');
}

function handleDoctorSave(event) {
  event.preventDefault();
  if (!state.admin.activeDoctorId) return;

  const doctorId = state.admin.activeDoctorId;
  const overrides = state.doctorOverrides[doctorId] ? { ...state.doctorOverrides[doctorId] } : {};

  overrides.name = document.getElementById('doctor-name')?.value?.trim() || '';
  overrides.bio_es = document.getElementById('doctor-bio-es')?.value?.trim() || '';
  overrides.bio_en = document.getElementById('doctor-bio-en')?.value?.trim() || '';
  overrides.calendly = document.getElementById('doctor-calendly')?.value?.trim() || '';
  overrides.whatsapp = document.getElementById('doctor-whatsapp')?.value?.trim() || '';
  overrides.image = state.admin.pendingImageData || null;

  const servicesContainer = document.getElementById('doctor-edit-services');
  const serviceOverrides = {};
  servicesContainer?.querySelectorAll('.service-fieldset').forEach((fieldset) => {
    const code = fieldset.dataset.serviceCode;
    if (!code) return;
    const labelEs = fieldset.querySelector("input[name='label_es']")?.value?.trim() || '';
    const labelEn = fieldset.querySelector("input[name='label_en']")?.value?.trim() || '';
    const descriptionEs = fieldset.querySelector("textarea[name='description_es']")?.value?.trim() || '';
    const descriptionEn = fieldset.querySelector("textarea[name='description_en']")?.value?.trim() || '';
    const usdValue = Number(fieldset.querySelector("input[name='usd']")?.value);
    const eurValue = Number(fieldset.querySelector("input[name='eur']")?.value);

    serviceOverrides[code] = {
      label_es: labelEs,
      label_en: labelEn,
      description_es: descriptionEs,
      description_en: descriptionEn,
      usd: Number.isNaN(usdValue) ? undefined : usdValue,
      eur: Number.isNaN(eurValue) ? undefined : eurValue,
    };
  });

  overrides.services = serviceOverrides;

  state.doctorOverrides[doctorId] = overrides;
  saveDoctorOverrides();
  applyDoctorState();
  renderDoctors();
  renderDoctorSelect();
  renderServices();
  renderFaq();
  syncSelections();
  populateDoctorLoginSelect();

  const status = document.getElementById('doctor-save-status');
  if (status) {
    status.textContent = t('admin.saveSuccess');
  }
}

function openDoctorPortal() {
  const modal = document.getElementById('doctor-portal-modal');
  if (!modal) return;
  populateDoctorLoginSelect();
  modal.hidden = false;
  document.body.style.overflow = 'hidden';

  const loginSection = document.getElementById('doctor-login-section');
  const editSection = document.getElementById('doctor-edit-section');
  if (state.admin.activeDoctorId) {
    if (loginSection) loginSection.hidden = true;
    if (editSection) editSection.hidden = false;
    fillDoctorEditForm(state.admin.activeDoctorId);
  } else {
    document.getElementById('doctor-login-form')?.reset();
    if (loginSection) loginSection.hidden = false;
    if (editSection) editSection.hidden = true;
    const errorEl = document.getElementById('doctor-login-error');
    if (errorEl) errorEl.textContent = '';
  }

  const focusTarget = state.admin.activeDoctorId
    ? document.getElementById('doctor-name')
    : document.getElementById('doctor-login-select');
  focusTarget?.focus();
}

function closeDoctorPortal() {
  const modal = document.getElementById('doctor-portal-modal');
  if (!modal) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  document.getElementById('doctor-login-form')?.reset();
  const status = document.getElementById('doctor-save-status');
  if (status) status.textContent = '';
  const errorEl = document.getElementById('doctor-login-error');
  if (errorEl) errorEl.textContent = '';
  const imageInput = document.getElementById('doctor-image-input');
  if (imageInput) imageInput.value = '';
}

function setupDoctorPortal() {
  const portalBtn = document.getElementById('doctor-portal-btn');
  const modal = document.getElementById('doctor-portal-modal');
  if (!portalBtn || !modal) return;

  portalBtn.addEventListener('click', openDoctorPortal);
  document.getElementById('doctor-portal-close')?.addEventListener('click', closeDoctorPortal);
  modal.querySelectorAll('[data-modal-close]').forEach((element) => {
    element.addEventListener('click', closeDoctorPortal);
  });
  document.getElementById('doctor-login-form')?.addEventListener('submit', handleDoctorLogin);
  document.getElementById('doctor-edit-form')?.addEventListener('submit', handleDoctorSave);
  document.getElementById('doctor-logout-btn')?.addEventListener('click', handleDoctorLogout);
  document.getElementById('doctor-image-input')?.addEventListener('change', handleDoctorImageChange);
  document.getElementById('doctor-image-remove')?.addEventListener('click', handleDoctorImageRemove);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) {
      closeDoctorPortal();
    }
  });

  populateDoctorLoginSelect();
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
    state.doctorOverrides = loadDoctorOverrides();

    const [i18n, doctorsData, faqEs, faqEn] = await Promise.all([
      fetchJSON('data/i18n.json'),
      fetchJSON('data/doctors.json'),
      fetchJSON('data/faq_es.json'),
      fetchJSON('data/faq_en.json'),
    ]);

    state.i18n = i18n;
    state.baseDoctors = doctorsData.doctors;
    applyDoctorState();
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

    setupDoctorPortal();
  } catch (error) {
    console.error('Error inicializando la aplicación', error);
    const container = document.querySelector('main');
    if (container) {
      container.innerHTML = `<section class="section"><div class="container"><h2>Se produjo un error</h2><p>${error.message}</p></div></section>`;
    }
  }
}

init();
