(function () {
  'use strict';

  const body = document.body;
  const offer = body.dataset.offer || 'site';
  const variant = body.dataset.variant || 'a';
  const route = window.location.pathname;
  const pageId = offer + '-' + variant;
  const campaignKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

  window.dataLayer = window.dataLayer || [];

  function track(eventName, details) {
    const payload = Object.assign({
      event: eventName,
      offer: offer,
      variant: variant,
      segment: body.dataset.segment || '',
      page_id: pageId,
      page_path: route
    }, details || {});

    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('viviane:' + eventName, { detail: payload }));
  }

  window.vivianeTrack = track;

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

  const currentUrl = new URL(window.location.href);
  const campaign = {};

  if (variant === 'f') {
    const segmentKey = offer === 'memorias' ? 'intencao' : 'estagio';
    const allowedSegments = offer === 'memorias' ? ['pessoal', 'familia'] : ['ideia', 'andamento', 'manuscrito'];
    const requestedSegment = currentUrl.searchParams.get(segmentKey);
    body.dataset.segment = allowedSegments.includes(requestedSegment) ? requestedSegment : allowedSegments[0];
  }

  campaignKeys.forEach(function (key) {
    const incomingValue = currentUrl.searchParams.get(key);
    if (incomingValue) safeSessionSet('viviane_' + key, incomingValue);
    campaign[key] = incomingValue || safeSessionGet('viviane_' + key);
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
    });
  });

  document.querySelectorAll('[data-restart]').forEach(function (button) {
    button.addEventListener('click', function () { track('quiz_restart'); });
  });

  document.querySelectorAll('form[data-netlify-ajax]').forEach(function (form) {
    let started = false;
    let qualifiedLeadTracked = false;
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

        track('form_submit_success', { form_name: form.getAttribute('name') || form.id || '' });
        if (!qualifiedLeadTracked) {
          const investment = String(formData.get('investimento') || formData.get('disponibilidade') || formData.get('q6') || '');
          if (/tenho disponibilidade|a partir de r\$\s*9(?:\.|\s)?997/i.test(investment)) {
            qualifiedLeadTracked = true;
            track('qualified_lead', {
              form_name: form.getAttribute('name') || form.id || '',
              stage: String(formData.get('estagio') || formData.get('q1') || '')
            });
          }
        }
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

    form.addEventListener('aust:form:submitted', function () {
      if (status) {
        status.textContent = form.dataset.successMessage || 'Recebemos as suas respostas. A Viviane poderá entrar em contato pelo e-mail ou WhatsApp informado.';
        status.classList.add('text-ink');
      }
      if (submitButton) submitButton.textContent = 'Diagnóstico enviado';
    });

    form.addEventListener('aust:form:error', function () {
      if (status) {
        status.textContent = 'Não foi possível enviar agora. Confira a sua conexão e tente novamente.';
        status.classList.remove('text-ink');
      }
      if (submitButton) submitButton.textContent = 'Enviar meu diagnóstico';
    });
  });

  track('page_view', {
    referrer: document.referrer || '',
    utm_source: campaign.utm_source || '',
    utm_medium: campaign.utm_medium || '',
    utm_campaign: campaign.utm_campaign || '',
    utm_content: campaign.utm_content || '',
    utm_term: campaign.utm_term || ''
  });
})();
