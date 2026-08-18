(function () {
  'use strict';

  const body = document.body;
  const pendingApplicationKey = 'viviane_pending_application';
  const isConversionPage = body.dataset.conversionPage === 'true';

  function readPendingApplication() {
    if (!isConversionPage) return null;
    try {
      const value = JSON.parse(window.sessionStorage.getItem(pendingApplicationKey) || 'null');
      if (!value || value.offer !== 'mentoria' || !/^[a-j]$/.test(value.variant)) return null;
      const expectedPath = value.variant === 'a' ? '/mentoria/' : '/mentoria' + value.variant + '/';
      const normalizedPath = String(value.page_path || '').replace(/\/+$/, '') + '/';
      const age = Date.now() - Number(value.submitted_at || 0);
      if (normalizedPath !== expectedPath || age < 0 || age > 30 * 60 * 1000) return null;
      if (typeof value.qualified !== 'boolean') return null;
      return {
        offer: value.offer,
        variant: value.variant,
        page_path: expectedPath,
        form_name: String(value.form_name || '').slice(0, 80),
        stage: String(value.stage || '').slice(0, 80),
        qualified: value.qualified
      };
    } catch (error) {
      return null;
    }
  }

  const pendingApplication = readPendingApplication();
  const offer = pendingApplication ? pendingApplication.offer : (body.dataset.offer || 'site');
  const variant = pendingApplication ? pendingApplication.variant : (body.dataset.variant || 'a');
  const route = pendingApplication ? pendingApplication.page_path : window.location.pathname;
  const pageId = offer + '-' + variant;
  const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  const metaPixelId = '1091512559548489';
  const analyticsEndpoint = '/api/track';
  const metaEventsEndpoint = '/api/meta/events';
  const campaign = {};
  const currentHostname = window.location.hostname.toLowerCase();
  const isProductionDomain = currentHostname === 'vivianepossato.com' || currentHostname.endsWith('.vivianepossato.com');
  const trackingSuppressed = !isProductionDomain ||
    new URLSearchParams(window.location.search).get('qa') === '1' ||
    (isConversionPage && !pendingApplication);
  const metaCustomEvents = {
    quiz_start: 'QuizStart',
    quiz_step: 'QuizStep',
    quiz_complete: 'QuizComplete',
    personalization_start: 'PersonalizationStart',
    personalization_step: 'PersonalizationStep',
    personalization_complete: 'PersonalizedResult',
    mechanism_start: 'ExperienceStart',
    mechanism_step: 'ExperienceStep',
    mechanism_complete: 'ExperienceComplete',
    form_start: 'ApplicationStart',
    qualified_lead: 'QualifiedLead'
  };

  window.dataLayer = window.dataLayer || [];

  function createAnonymousId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return prefix + '-' + window.crypto.randomUUID();
    }
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  function getOrCreateAnonymousId(storage, key, prefix) {
    try {
      const current = storage.getItem(key);
      if (current) return current;
      const created = createAnonymousId(prefix);
      storage.setItem(key, created);
      return created;
    } catch (error) {
      return createAnonymousId(prefix);
    }
  }

  const visitorId = getOrCreateAnonymousId(window.localStorage, 'viviane_visitor_id', 'v');
  const sessionId = getOrCreateAnonymousId(window.sessionStorage, 'viviane_session_id', 's');

  function sendAnalytics(payload) {
    if (trackingSuppressed) return;
    const bodyValue = JSON.stringify(payload);
    if (bodyValue.length > 8000) return;

    window.fetch(analyticsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyValue,
      credentials: 'same-origin',
      keepalive: true
    }).catch(function () {
      return;
    });
  }

  function createMetaEventId() {
    return createAnonymousId('meta');
  }

  function readCookie(name) {
    const prefix = name + '=';
    const part = String(document.cookie || '').split(';').map(function (value) { return value.trim(); }).find(function (value) {
      return value.indexOf(prefix) === 0;
    });
    return part ? decodeURIComponent(part.slice(prefix.length)) : '';
  }

  function metaClickCookie() {
    const stored = readCookie('_fbc');
    if (stored) return stored;
    const clickId = new URL(window.location.href).searchParams.get('fbclid');
    return clickId ? 'fb.1.' + Date.now() + '.' + clickId : '';
  }

  function sendMetaServerEvent(eventName, eventId) {
    if (trackingSuppressed) return;
    const payload = JSON.stringify({
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.origin + window.location.pathname,
      fbp: readCookie('_fbp'),
      fbc: metaClickCookie()
    });
    if (payload.length > 4000) return;
    window.fetch(metaEventsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      credentials: 'same-origin',
      keepalive: true
    }).catch(function () {
      return;
    });
  }

  function trackMetaCustom(eventName, details) {
    const metaEventName = metaCustomEvents[eventName];
    if (trackingSuppressed || !metaEventName) return;

    const eventId = createMetaEventId();
    if (typeof window.fbq === 'function') {
      window.fbq('trackCustom', metaEventName, {
        content_name: pageId,
        content_category: offer,
        variant: variant,
        step: String((details && (details.step || details.next_step)) || '')
      }, { eventID: eventId });
    }
    sendMetaServerEvent(metaEventName, eventId);
  }

  function track(eventName, details) {
    const payload = Object.assign({
      event: eventName,
      offer: offer,
      variant: variant,
      segment: body.dataset.segment || '',
      page_id: pageId,
      page_path: route,
      visitor_id: visitorId,
      session_id: sessionId,
      utm_source: campaign.utm_source || '',
      utm_medium: campaign.utm_medium || '',
      utm_campaign: campaign.utm_campaign || '',
      utm_content: campaign.utm_content || '',
      utm_term: campaign.utm_term || ''
    }, details || {});

    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('viviane:' + eventName, { detail: payload }));
    sendAnalytics(payload);
    trackMetaCustom(eventName, details || {});
  }

  window.vivianeTrack = track;

  function initializeMetaPixel() {
    if (trackingSuppressed || window.__vivianeMetaPixelInitialized) return;

    const fbq = window.fbq = window.fbq || function () {
      if (fbq.callMethod) {
        fbq.callMethod.apply(fbq, arguments);
      } else {
        fbq.queue.push(arguments);
      }
    };

    window._fbq = window._fbq || fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = fbq.queue || [];

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(script);

    fbq('init', metaPixelId);
    const pageViewEventId = createMetaEventId();
    fbq('track', 'PageView', {}, { eventID: pageViewEventId });
    sendMetaServerEvent('PageView', pageViewEventId);
    window.__vivianeMetaPixelInitialized = true;
  }

  function trackMeta(eventName, details) {
    if (trackingSuppressed) return;
    const eventId = createMetaEventId();
    if (typeof window.fbq === 'function') window.fbq('track', eventName, details || {}, { eventID: eventId });
    sendMetaServerEvent(eventName, eventId);
  }

  initializeMetaPixel();

  function safeSessionGet(key) {
    try {
      return window.sessionStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function safeSessionSet(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  }

  function safeSessionRemove(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }

  const currentUrl = new URL(window.location.href);
  if (variant === 'f') {
    const segmentKey = offer === 'memorias' ? 'intencao' : 'estagio';
    const allowedSegments = offer === 'memorias' ? ['pessoal', 'familia'] : ['ideia', 'andamento', 'manuscrito'];
    const requestedSegment = currentUrl.searchParams.get(segmentKey);
    body.dataset.segment = allowedSegments.includes(requestedSegment) ? requestedSegment : allowedSegments[0];
  }

  const hasIncomingCampaign = campaignKeys.some(function (key) {
    return currentUrl.searchParams.has(key);
  });

  campaignKeys.forEach(function (key) {
    const storageKey = 'viviane_' + key;
    const incomingValue = currentUrl.searchParams.get(key) || '';

    if (hasIncomingCampaign) {
      if (incomingValue) {
        safeSessionSet(storageKey, incomingValue);
      } else {
        safeSessionRemove(storageKey);
      }
      campaign[key] = incomingValue;
      return;
    }

    campaign[key] = safeSessionGet(storageKey);
  });

  if (!campaign.utm_content) campaign.utm_content = pageId;

  function populateFormContext(scope) {
    scope.querySelectorAll('input[data-campaign-field]').forEach(function (field) {
      field.value = campaign[field.name] || '';
    });

    scope.querySelectorAll('input[name="pagina"]').forEach(function (field) {
      field.value = pageId;
    });

    scope.querySelectorAll('input[name="rota"]').forEach(function (field) {
      field.value = route;
    });
  }

  function trimFormFields(form) {
    form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(function (field) {
      field.value = field.value.trim();
    });
  }

  function validatePhoneField(field) {
    const value = field.value.trim();
    const digits = field.value.replace(/\D/g, '');
    const hasValidLength = !value || (digits.length >= 10 && digits.length <= 15);
    field.setCustomValidity(hasValidLength ? '' : 'Informe um telefone com 10 a 15 dígitos.');
  }

  function getInvestmentContext(form, formData) {
    const fieldNames = ['investimento', 'disponibilidade', 'q6', 'financial_fit'];
    let field = null;
    let value = '';

    fieldNames.some(function (name) {
      const checked = form.querySelector('[name="' + name + '"]:checked');
      const control = checked || form.querySelector('[name="' + name + '"]');
      const formValue = formData ? formData.get(name) : '';
      if (!control && !formValue) return false;
      field = control;
      value = String(formValue || (control && control.value) || '');
      return true;
    });

    const qualified = true;

    return { qualified: qualified, value: value };
  }

  function getFormStage(formData) {
    if (!formData) return '';
    return String(formData.get('estagio') || formData.get('q1') || formData.get('momento') || '');
  }

  function clearPendingApplication() {
    try {
      window.sessionStorage.removeItem(pendingApplicationKey);
    } catch (error) {
      return;
    }
  }

  function storePendingApplication(form, formData) {
    const investment = getInvestmentContext(form, formData);
    try {
      window.sessionStorage.setItem(pendingApplicationKey, JSON.stringify({
        offer: offer,
        variant: variant,
        page_path: route,
        form_name: form.getAttribute('name') || form.id || '',
        stage: getFormStage(formData),
        qualified: investment.qualified,
        submitted_at: Date.now()
      }));
    } catch (error) {
      return;
    }
  }

  function recordApplicationEvents(formName, investment, stage, source, form) {
    track('form_submit_success', {
      form_name: formName,
      submission_source: source || '',
      qualified: investment.qualified
    });
    track('application_qualification', {
      form_name: formName,
      qualified: investment.qualified,
      stage: stage
    });

    if (form && form.dataset.qualifiedConversionTracked === 'true') return;

    if (form) form.dataset.qualifiedConversionTracked = 'true';
    track('qualified_lead', {
      form_name: formName,
      qualified: true,
      stage: stage
    });
    trackMeta('Lead', {
      content_name: pageId,
      content_category: 'Mentoria Página a Página',
      status: 'submitted'
    });
  }

  function recordSuccessfulApplication(form, formData, source) {
    const currentTime = Date.now();
    const lastSuccess = Number(form.dataset.lastTrackedSuccess || 0);
    if (currentTime - lastSuccess < 2000) return;
    form.dataset.lastTrackedSuccess = String(currentTime);

    const formName = form.getAttribute('name') || form.id || '';
    const investment = getInvestmentContext(form, formData);
    recordApplicationEvents(formName, investment, getFormStage(formData), source, form);
  }

  populateFormContext(document);

  document.querySelectorAll('a[href*="pay.hotmart.com"]').forEach(function (link) {
    const checkoutUrl = new URL(link.href);
    checkoutUrl.searchParams.set('sck', pageId);
    campaignKeys.forEach(function (key) {
      if (campaign[key]) checkoutUrl.searchParams.set(key, campaign[key]);
    });
    link.href = checkoutUrl.toString();
    link.dataset.track = link.dataset.track || 'checkout_click';
  });

  document.querySelectorAll('a[href="#diagnostico"], a[href="#aplicacao"]').forEach(function (link) {
    link.dataset.track = link.dataset.track || 'lead_cta_click';
  });

  document.querySelectorAll('[data-track]').forEach(function (element) {
    element.addEventListener('click', function () {
      track(element.dataset.track, {
        label: element.dataset.trackLabel || element.textContent.trim().slice(0, 120),
        destination: element.href || ''
      });
      if (element.dataset.track === 'checkout_click') {
        trackMeta('InitiateCheckout', {
          content_name: pageId,
          content_category: 'Escrita de Memórias'
        });
      }
    });
  });

  document.querySelectorAll('[data-restart]').forEach(function (button) {
    button.addEventListener('click', function () { track('quiz_restart'); });
  });

  document.querySelectorAll('form[data-netlify-ajax]').forEach(function (form) {
    let started = false;
    let activeController = null;
    let submissionSequence = 0;
    const status = form.querySelector('[data-form-status]') || document.getElementById('formNote') || document.getElementById('actionStatus');
    const submitButton = form.querySelector('button[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    const originalStatusText = status ? status.textContent : '';

    form.querySelectorAll('input[type="tel"]').forEach(function (field) {
      field.addEventListener('input', function () { validatePhoneField(field); });
    });

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { form_name: form.getAttribute('name') || form.id || '' });
    });

    form.addEventListener('reset', function () {
      submissionSequence += 1;
      if (activeController) activeController.abort();
      activeController = null;
      window.setTimeout(function () {
        populateFormContext(form);
        form.querySelectorAll('input[type="tel"]').forEach(function (field) { validatePhoneField(field); });
        started = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
          submitButton.removeAttribute('aria-busy');
        }
        if (status) {
          status.textContent = originalStatusText;
          status.classList.remove('text-ink');
        }
      }, 0);
    });

    form.addEventListener('submit', async function (event) {
      event.preventDefault();

      trimFormFields(form);
      form.querySelectorAll('input[type="tel"]').forEach(function (field) { validatePhoneField(field); });

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
        submitButton.setAttribute('aria-busy', 'true');
      }
      if (status) status.textContent = 'Enviando as suas respostas.';
      track('form_submit_attempt', { form_name: form.getAttribute('name') || form.id || '' });

      const formData = new FormData(form);
      const controller = new AbortController();
      const submissionId = ++submissionSequence;
      activeController = controller;
      const timeoutId = window.setTimeout(function () { controller.abort(); }, 15000);

      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData).toString(),
          signal: controller.signal
        });

        if (submissionId !== submissionSequence) return;
        if (!response.ok) throw new Error('Falha no envio');

        recordSuccessfulApplication(form, formData, 'netlify');
        if (status) {
          status.textContent = form.dataset.successMessage || 'Recebemos as suas respostas. A Viviane poderá entrar em contato pelo e-mail ou WhatsApp informado.';
          status.classList.add('text-ink');
        }
        if (submitButton) submitButton.textContent = 'Diagnóstico enviado';
      } catch (error) {
        if (submissionId !== submissionSequence) return;
        track('form_submit_error', { form_name: form.getAttribute('name') || form.id || '' });
        if (status) status.textContent = 'Não foi possível enviar agora. Confira a sua conexão e tente novamente.';
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (activeController === controller) activeController = null;
        if (submissionId === submissionSequence && submitButton) submitButton.removeAttribute('aria-busy');
      }
    });
  });

  document.querySelectorAll('form#lead-form').forEach(function (form) {
    const status = form.querySelector('[data-form-status]');
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    const originalButtonText = submitButton ? submitButton.textContent : '';
    const originalStatusText = status ? status.textContent : '';
    let started = false;

    form.querySelectorAll('input[type="tel"]').forEach(function (field) {
      validatePhoneField(field);
      field.addEventListener('input', function () { validatePhoneField(field); });
    });

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      track('form_start', { form_name: form.getAttribute('name') || form.id || '' });
    });

    form.addEventListener('reset', function () {
      clearPendingApplication();
      window.setTimeout(function () {
        populateFormContext(form);
        form.querySelectorAll('input[type="tel"]').forEach(function (field) { validatePhoneField(field); });
        delete form.dataset.lastTrackedSuccess;
        delete form.dataset.qualifiedConversionTracked;
        started = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
          submitButton.removeAttribute('aria-busy');
        }
        if (status) {
          status.textContent = originalStatusText;
          status.classList.remove('text-ink');
        }
      }, 0);
    });

    form.addEventListener('submit', function (event) {
      trimFormFields(form);
      form.querySelectorAll('input[type="tel"]').forEach(function (field) { validatePhoneField(field); });
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.reportValidity();
        return;
      }
      const formData = new FormData(form);
      track('form_submit_attempt', { form_name: form.getAttribute('name') || form.id || '' });
      storePendingApplication(form, formData);
    }, true);

    form.addEventListener('aust:form:submitted', function () {
      recordSuccessfulApplication(form, new FormData(form), 'aust');
      clearPendingApplication();
      if (status) {
        status.textContent = form.dataset.successMessage || 'Recebemos as suas respostas. A Viviane poderá entrar em contato pelo e-mail ou WhatsApp informado.';
        status.classList.add('text-ink');
      }
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Diagnóstico enviado';
        submitButton.removeAttribute('aria-busy');
      }
      window.location.assign(form.getAttribute('action') || '/obrigada/');
    });

    form.addEventListener('aust:form:error', function () {
      clearPendingApplication();
      track('form_submit_error', { form_name: form.getAttribute('name') || form.id || '', submission_source: 'aust' });
      if (status) {
        status.textContent = 'Não foi possível enviar agora. Confira a sua conexão e tente novamente.';
        status.classList.remove('text-ink');
      }
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;
        submitButton.removeAttribute('aria-busy');
      }
    });
  });

  if (isConversionPage) {
    if (pendingApplication) {
      recordApplicationEvents(
        pendingApplication.form_name,
        { qualified: pendingApplication.qualified, value: '' },
        pendingApplication.stage,
        'netlify-redirect',
        null
      );
      clearPendingApplication();
    }
    return;
  }

  let meaningfulViewTracked = false;
  const scrollDepthsTracked = {};
  let scrollDepthSuppressedUntil = 0;

  window.addEventListener('viviane:programmatic-scroll', function (event) {
    const requestedDuration = Number(event.detail && event.detail.duration);
    const duration = Number.isFinite(requestedDuration)
      ? Math.max(0, Math.min(requestedDuration, 3000))
      : 1200;
    scrollDepthSuppressedUntil = Math.max(scrollDepthSuppressedUntil, Date.now() + duration);
  });

  function trackMeaningfulView(trigger) {
    if (meaningfulViewTracked) return;
    meaningfulViewTracked = true;
    track('engaged_view', { trigger: trigger });
    trackMeta('ViewContent', {
      content_name: pageId,
      content_category: offer
    });
  }

  function inspectScrollDepth() {
    if (Date.now() < scrollDepthSuppressedUntil) return;
    const documentHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const depth = Math.min(100, Math.round((window.scrollY / documentHeight) * 100));

    [25, 50, 75, 90].forEach(function (threshold) {
      if (depth < threshold || scrollDepthsTracked[threshold]) return;
      scrollDepthsTracked[threshold] = true;
      track('scroll_depth', { depth: threshold });
      if (threshold === 25) trackMeaningfulView('scroll_25');
    });
  }

  let scrollFrame = null;
  window.addEventListener('scroll', function () {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(function () {
      scrollFrame = null;
      inspectScrollDepth();
    });
  }, { passive: true });

  window.setTimeout(function () { trackMeaningfulView('time_15s'); }, 15000);

  track('page_view', {
    referrer: document.referrer || '',
    utm_source: campaign.utm_source || '',
    utm_medium: campaign.utm_medium || '',
    utm_campaign: campaign.utm_campaign || '',
    utm_content: campaign.utm_content || '',
    utm_term: campaign.utm_term || ''
  });
})();
