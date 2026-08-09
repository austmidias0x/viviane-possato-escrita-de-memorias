(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const body = document.body;
  const offer = body.dataset.offer || '';
  const journey = document.querySelector('[data-personalization]');
  const choiceForm = document.querySelector('[data-choice-form]');
  const steps = Array.from(document.querySelectorAll('[data-choice-step]'));
  const lines = Array.from(document.querySelectorAll('[data-manuscript-line]'));
  const progressBar = document.querySelector('[data-manuscript-progress]');
  const progressText = document.querySelector('[data-progress-text]');
  const pageCount = document.querySelector('[data-page-count]');
  const liveStatus = document.querySelector('[data-live-status]');
  const offerTitle = document.querySelector('[data-result-title]');
  const offerSummary = document.querySelector('[data-result-summary]');
  const pageStatus = document.querySelector('.i-page__status');
  const resultField = document.querySelector('[name="resumo_personalizado"]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const typingTokens = new WeakMap();
  let personalizationStarted = false;
  let personalizationCompleted = false;
  let scrollQueued = false;
  let choiceNavigationTimer = null;
  let headingFocusTimer = null;
  let lastInputMethod = 'other';
  let lastNavigationKey = '';
  const initialOfferTitle = offerTitle ? offerTitle.textContent : '';
  const initialOfferSummary = offerSummary ? offerSummary.textContent : '';
  const initialPageStatus = pageStatus ? pageStatus.textContent : '';

  if (!journey || !choiceForm || !steps.length) return;

  function track(eventName, details) {
    if (typeof window.vivianeTrack === 'function') {
      window.vivianeTrack(eventName, details || {});
    }
  }

  function startPersonalization(source) {
    if (personalizationStarted) return;
    personalizationStarted = true;
    track('personalization_start', {
      trigger: source || 'first_choice'
    });
  }

  function selectedInput(step) {
    return step.querySelector('input[type="radio"]:checked');
  }

  function selectedState() {
    const state = {};
    steps.forEach(function (step) {
      const input = selectedInput(step);
      if (input) state[step.dataset.key] = input;
    });
    return state;
  }

  function typeLine(element, text) {
    const token = (typingTokens.get(element) || 0) + 1;
    typingTokens.set(element, token);
    element.classList.add('is-written');

    if (reducedMotion) {
      element.textContent = text;
      element.classList.remove('is-writing');
      return;
    }

    element.classList.add('is-writing');
    element.textContent = '';
    let cursor = 0;

    function writeChunk() {
      if (typingTokens.get(element) !== token) return;
      cursor = Math.min(text.length, cursor + 3);
      element.textContent = text.slice(0, cursor);
      if (cursor < text.length) {
        window.setTimeout(writeChunk, 18);
      } else {
        element.classList.remove('is-writing');
      }
    }

    writeChunk();
  }

  function setMirrorField(key, value) {
    document.querySelectorAll('[data-mirror-field="' + key + '"]').forEach(function (field) {
      field.value = value;
    });
  }

  function buildSummary(state) {
    const values = {};
    Object.keys(state).forEach(function (key) {
      values[key] = state[key].dataset.summary || state[key].value;
    });

    if (offer === 'memorias') {
      if (!values.semente || !values.detalhe || !values.intencao || !values.estagio) return '';
      return 'Você quer ' + values.semente + ', ' + values.detalhe + ' e ' + values.intencao + '. ' + values.estagio + ' O curso pode oferecer uma prática por vez para escolher a cena, recuperar os detalhes e continuar a escrita.';
    }

    if (!values.origem || !values.estagio || !values.decisao || !values.apoio) return '';
    return 'O livro parte ' + values.origem + '. ' + values.estagio + ' Neste momento, você procura ' + values.decisao + ' e quer ' + values.apoio + '. Essas respostas ajudam Viviane a chegar à conversa com o contexto do projeto.';
  }

  function updateResult(state) {
    const summary = buildSummary(state);
    if (!summary) return;

    const lastKey = offer === 'memorias' ? 'estagio' : 'apoio';
    const title = state[lastKey] && state[lastKey].dataset.resultTitle;
    if (title && offerTitle) offerTitle.textContent = title;
    if (offerSummary) offerSummary.textContent = summary;
    if (resultField) resultField.value = summary;
  }

  function updateProgress() {
    const completeCount = steps.filter(function (step) { return Boolean(selectedInput(step)); }).length;
    const percent = Math.round((completeCount / steps.length) * 100);
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = completeCount + ' de ' + steps.length + ' escolhas';
    if (pageCount) pageCount.textContent = String(completeCount).padStart(2, '0') + ' / ' + String(steps.length).padStart(2, '0');
    return completeCount;
  }

  function unlockStep(index) {
    const step = steps[index];
    if (!step) return;
    step.dataset.lock = 'false';
    const fieldset = step.querySelector('fieldset');
    if (fieldset) fieldset.disabled = false;
  }

  function announce(message) {
    if (!liveStatus) return;
    liveStatus.textContent = '';
    window.setTimeout(function () { liveStatus.textContent = message; }, 20);
  }

  function handleChoice(event) {
    const input = event.target.closest('input[type="radio"]');
    if (!input) return;
    const step = input.closest('[data-choice-step]');
    const stepIndex = steps.indexOf(step);
    const lineKey = step.dataset.line;
    const line = lines.find(function (item) { return item.dataset.manuscriptLine === lineKey; });
    const fragment = input.dataset.fragment || input.value;

    startPersonalization('choice');
    step.classList.add('is-complete');
    if (line) typeLine(line, fragment);
    setMirrorField(step.dataset.key, input.value);
    unlockStep(stepIndex + 1);

    const unlock = step.querySelector('[data-unlock]');
    if (unlock) unlock.hidden = false;

    const completeCount = updateProgress();
    const state = selectedState();
    updateResult(state);
    track('personalization_step', {
      step: step.dataset.key,
      next_step: stepIndex === steps.length - 1 ? 'oferta' : steps[stepIndex + 1].dataset.key,
      label: input.value
    });

    if (completeCount === steps.length) {
      if (!personalizationCompleted) {
        personalizationCompleted = true;
        track('personalization_complete', {
          step: 'complete',
          trigger: 'four_choices'
        });
      }
      if (pageStatus) pageStatus.textContent = 'As quatro linhas estão prontas. A síntese está liberada abaixo.';
      announce('Nova linha: ' + fragment + ' As quatro linhas estão prontas. A síntese está liberada abaixo.');
    } else {
      if (pageStatus) pageStatus.textContent = 'Linha ' + completeCount + ' de ' + steps.length + ' registrada. Continue na próxima escolha.';
      announce('Nova linha: ' + fragment + ' A próxima escolha está liberada.');
    }

    const nextTarget = stepIndex === steps.length - 1
      ? document.getElementById('oferta')
      : steps[stepIndex + 1];
    queueChoiceNavigation(nextTarget);
  }

  function cancelPendingChoiceNavigation() {
    if (choiceNavigationTimer) window.clearTimeout(choiceNavigationTimer);
    if (headingFocusTimer) window.clearTimeout(headingFocusTimer);
    choiceNavigationTimer = null;
    headingFocusTimer = null;
  }

  function choiceNavigationDelay() {
    const usedArrowKey = lastInputMethod === 'keyboard' && /^Arrow/.test(lastNavigationKey);
    if (usedArrowKey) return 1000;
    return reducedMotion ? 0 : 220;
  }

  function queueChoiceNavigation(target) {
    cancelPendingChoiceNavigation();
    choiceNavigationTimer = window.setTimeout(function () {
      choiceNavigationTimer = null;
      goTo(target);
    }, choiceNavigationDelay());
  }

  function goTo(target) {
    if (!target) return;
    cancelPendingChoiceNavigation();
    window.dispatchEvent(new CustomEvent('viviane:programmatic-scroll', {
      detail: { duration: reducedMotion ? 100 : 1400 }
    }));
    target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    headingFocusTimer = window.setTimeout(function () {
      headingFocusTimer = null;
      const focusTarget = target.querySelector('legend, h2, h3');
      if (focusTarget) {
        focusTarget.setAttribute('tabindex', '-1');
        focusTarget.focus({ preventScroll: true });
      }
    }, reducedMotion ? 0 : 520);
  }

  document.querySelectorAll('[data-start-personalization]').forEach(function (button) {
    button.addEventListener('click', function (event) {
      const href = button.getAttribute('href');
      if (href && href.charAt(0) === '#') event.preventDefault();
      startPersonalization('start_button');
      goTo(steps[0]);
    });
  });

  document.querySelectorAll('[data-next-step]').forEach(function (button) {
    button.addEventListener('click', function () {
      const targetId = button.dataset.nextStep;
      const target = targetId === 'offer' ? document.getElementById('oferta') : document.querySelector('[data-choice-step="' + targetId + '"]');
      goTo(target);
    });
  });

  choiceForm.addEventListener('pointerdown', function () {
    lastInputMethod = 'pointer';
    lastNavigationKey = '';
  });
  choiceForm.addEventListener('keydown', function (event) {
    lastInputMethod = 'keyboard';
    lastNavigationKey = event.key || '';
  });
  choiceForm.addEventListener('change', handleChoice);
  choiceForm.addEventListener('submit', function (event) { event.preventDefault(); });

  document.querySelectorAll('[data-restart-manuscript]').forEach(function (button) {
    button.addEventListener('click', function () {
      choiceForm.reset();
      steps.forEach(function (step, index) {
        step.classList.remove('is-complete', 'is-current');
        step.dataset.lock = index === 0 ? 'false' : 'true';
        const fieldset = step.querySelector('fieldset');
        if (fieldset) fieldset.disabled = index !== 0;
        const unlock = step.querySelector('[data-unlock]');
        if (unlock) unlock.hidden = true;
      });
      lines.forEach(function (line) {
        typingTokens.set(line, (typingTokens.get(line) || 0) + 1);
        line.textContent = line.dataset.placeholder || 'A próxima escolha escreve esta linha.';
        line.classList.remove('is-written', 'is-writing');
      });
      document.querySelectorAll('[data-mirror-field]').forEach(function (field) { field.value = ''; });
      if (resultField) resultField.value = '';
      if (offerTitle) offerTitle.textContent = initialOfferTitle;
      if (offerSummary) offerSummary.textContent = initialOfferSummary;
      if (pageStatus) pageStatus.textContent = initialPageStatus;
      personalizationStarted = false;
      personalizationCompleted = false;
      updateProgress();
      track('mechanism_restart', { trigger: 'restart_button' });
      announce(offer === 'memorias'
        ? 'A página foi limpa. Escolha uma nova lembrança para começar.'
        : 'A página foi limpa. Escolha novamente a origem do conteúdo para começar.');
      goTo(steps[0]);
    });
  });

  steps.forEach(function (step, index) {
    step.dataset.lock = index === 0 ? 'false' : 'true';
    const fieldset = step.querySelector('fieldset');
    if (fieldset) fieldset.disabled = index !== 0;
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting || entry.target.dataset.lock === 'true') return;
        steps.forEach(function (step) { step.classList.toggle('is-current', step === entry.target); });
      });
    }, { rootMargin: '-28% 0px -54% 0px', threshold: 0 });
    steps.forEach(function (step) { observer.observe(step); });
  }

  function updateScrollMotion() {
    scrollQueued = false;
    if (!journey || reducedMotion) return;
    const rect = journey.getBoundingClientRect();
    const viewport = window.innerHeight;
    const range = Math.max(1, rect.height - viewport * 0.55);
    const progress = Math.max(0, Math.min(1, (viewport * 0.28 - rect.top) / range));
    const mobile = window.innerWidth <= 980;
    const tilt = (progress - 0.5) * (mobile ? 1.2 : 4.2);
    const lift = Math.sin(progress * Math.PI) * (mobile ? -2 : -10);
    const pen = progress * (mobile ? 54 : 330);
    document.documentElement.style.setProperty('--book-tilt', tilt.toFixed(2) + 'deg');
    document.documentElement.style.setProperty('--book-lift', lift.toFixed(2) + 'px');
    document.documentElement.style.setProperty('--pen-y', pen.toFixed(2) + 'px');
  }

  window.addEventListener('scroll', function () {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(updateScrollMotion);
  }, { passive: true });
  window.addEventListener('resize', updateScrollMotion);
  updateScrollMotion();
  updateProgress();

  if (offer === 'mentoria') {
    const financeInputs = Array.from(document.querySelectorAll('input[name="investimento"][data-qualified]'));

    financeInputs.forEach(function (input) {
      input.addEventListener('change', function () {
        const qualified = input.dataset.qualified === 'true';
        track('qualification_select', {
          qualified: qualified,
          step: 'investment',
          label: input.value,
          form_name: 'mentoria-i'
        });
      });
    });
  }
})();
