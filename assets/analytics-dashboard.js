(function () {
  'use strict';

  const elements = {
    loadingView: document.getElementById('loadingView'),
    loginView: document.getElementById('loginView'),
    dashboardView: document.getElementById('dashboardView'),
    loginForm: document.getElementById('loginForm'),
    password: document.getElementById('password'),
    loginMessage: document.getElementById('loginMessage'),
    logoutButton: document.getElementById('logoutButton'),
    periodSelect: document.getElementById('periodSelect'),
    offerSelect: document.getElementById('offerSelect'),
    refreshButton: document.getElementById('refreshButton'),
    updatedAt: document.getElementById('updatedAt'),
    dashboardStatus: document.getElementById('dashboardStatus'),
    summaryCards: document.getElementById('summaryCards'),
    comparisonGrid: document.getElementById('comparisonGrid'),
    pagesTableBody: document.getElementById('pagesTableBody'),
    funnelsGrid: document.getElementById('funnelsGrid'),
    dataQuality: document.getElementById('dataQuality')
  };

  let report = null;

  function setVisible(view) {
    elements.loadingView.hidden = view !== 'loading';
    elements.loginView.hidden = view !== 'login';
    elements.dashboardView.hidden = view !== 'dashboard';
    elements.logoutButton.hidden = view !== 'dashboard';
  }

  function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(Number(value) || 0);
  }

  function formatPercent(value) {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(Number(value) || 0) + '%';
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Sao_Paulo'
    }).format(date);
  }

  function productName(offer) {
    return offer === 'mentoria' ? 'Mentoria' : 'Memórias';
  }

  function clear(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function node(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  async function requestJson(url, options) {
    const response = await window.fetch(url, Object.assign({
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    }, options || {}));
    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }
    return { response: response, payload: payload };
  }

  function showLogin(message) {
    report = null;
    setVisible('login');
    elements.loginMessage.textContent = message || '';
    elements.password.value = '';
    window.setTimeout(function () { elements.password.focus(); }, 0);
  }

  function currentPages() {
    if (!report) return [];
    const offer = elements.offerSelect.value;
    return report.pages.filter(function (page) {
      return offer === 'all' || page.offer === offer;
    });
  }

  function currentMetrics() {
    if (!report) return null;
    const offer = elements.offerSelect.value;
    return offer === 'all' ? report.totals : report.offers[offer];
  }

  function renderSummary() {
    const metrics = currentMetrics();
    clear(elements.summaryCards);
    if (!metrics) return;

    const cards = [
      ['Visitantes', metrics.visitors, formatNumber(metrics.sessions) + ' sessões'],
      ['Visualizações', metrics.views, formatNumber(metrics.engaged_visitors) + ' visitantes engajados'],
      ['Inícios', metrics.starts, formatPercent(metrics.rates.start) + ' dos visitantes'],
      ['Resultados', metrics.results, formatPercent(metrics.rates.start_to_result) + ' dos inícios'],
      ['Cliques no checkout', metrics.checkout_clicks, 'Visitantes que abriram o checkout'],
      ['Formulários enviados', metrics.form_submits, 'Envios confirmados pelo site'],
      ['Conversões', metrics.conversions, formatPercent(metrics.rates.visitor_to_conversion) + ' dos visitantes'],
      ['Leads qualificados', metrics.qualified_leads, formatPercent(metrics.rates.qualification) + ' dos envios avaliados']
    ];

    cards.forEach(function (card) {
      const article = node('article', 'metric-card');
      article.appendChild(node('p', 'metric-label', card[0]));
      article.appendChild(node('p', 'metric-value', formatNumber(card[1])));
      article.appendChild(node('p', 'metric-detail', card[2]));
      elements.summaryCards.appendChild(article);
    });
  }

  function variantRow(label, page) {
    const row = node('div', 'variant-row');
    row.appendChild(node('span', 'variant-tag', label));
    if (!page) {
      const empty = node('p', 'empty-copy', 'Sem eventos nesta variação durante o período.');
      empty.style.gridColumn = '2 / -1';
      row.appendChild(empty);
      return row;
    }

    const values = [
      ['Visitantes', formatNumber(page.visitors)],
      ['Conversões', formatNumber(page.conversions)],
      ['Taxa', formatPercent(page.rates.visitor_to_conversion)]
    ];
    values.forEach(function (value) {
      const stat = node('div', 'variant-stat');
      stat.appendChild(node('span', '', value[0]));
      stat.appendChild(node('strong', '', value[1]));
      row.appendChild(stat);
    });
    return row;
  }

  function renderComparisons() {
    clear(elements.comparisonGrid);
    if (!report) return;
    const selectedOffer = elements.offerSelect.value;
    const comparisons = report.comparisons.filter(function (comparison) {
      return selectedOffer === 'all' || comparison.offer === selectedOffer;
    });

    comparisons.forEach(function (comparison) {
      const article = node('article', 'comparison-card');
      const header = node('div', 'comparison-card-header');
      header.appendChild(node('h3', '', productName(comparison.offer)));
      header.appendChild(node('span', 'product-tag', 'Teste H x I'));
      article.appendChild(header);

      const body = node('div', 'comparison-body');
      body.appendChild(variantRow('H', comparison.h));
      body.appendChild(variantRow('I', comparison.i));
      article.appendChild(body);
      elements.comparisonGrid.appendChild(article);
    });
  }

  function renderTable() {
    clear(elements.pagesTableBody);
    const pages = currentPages();
    if (pages.length === 0) {
      const row = document.createElement('tr');
      const cell = node('td', 'empty-copy', 'Ainda não há eventos para este filtro.');
      cell.colSpan = 9;
      row.appendChild(cell);
      elements.pagesTableBody.appendChild(row);
      return;
    }

    pages.forEach(function (page) {
      const row = document.createElement('tr');
      const pageCell = document.createElement('td');
      pageCell.appendChild(node('span', 'page-name', productName(page.offer) + ' ' + page.variant.toUpperCase()));
      pageCell.appendChild(node('span', 'page-path', page.page_path));
      row.appendChild(pageCell);
      [
        formatNumber(page.visitors),
        formatNumber(page.views),
        formatNumber(page.starts),
        formatNumber(page.results),
        formatNumber(page.offer === 'mentoria' ? page.form_submits : page.checkout_clicks),
        formatNumber(page.conversions),
        formatNumber(page.qualified_leads),
        formatPercent(page.rates.visitor_to_conversion)
      ].forEach(function (value) {
        row.appendChild(node('td', '', value));
      });
      elements.pagesTableBody.appendChild(row);
    });
  }

  function renderFunnels() {
    clear(elements.funnelsGrid);
    const pages = currentPages();
    if (pages.length === 0) {
      elements.funnelsGrid.appendChild(node('p', 'empty-copy', 'Ainda não há etapas registradas para este filtro.'));
      return;
    }

    pages.forEach(function (page) {
      const article = node('article', 'funnel-card');
      const header = node('div', 'funnel-card-header');
      const titleGroup = document.createElement('div');
      titleGroup.appendChild(node('h3', '', productName(page.offer) + ' ' + page.variant.toUpperCase()));
      titleGroup.appendChild(node('span', 'page-path', page.page_path));
      header.appendChild(titleGroup);
      header.appendChild(node('span', 'variant-tag', formatPercent(page.rates.visitor_to_conversion)));
      article.appendChild(header);

      const body = node('div', 'funnel-body');
      page.funnel.forEach(function (stage) {
        const stageElement = node('div', 'funnel-stage');
        const line = node('div', 'funnel-stage-line');
        line.appendChild(node('span', '', stage.label));
        line.appendChild(node('span', '', formatNumber(stage.visitors) + ' · ' + formatPercent(stage.rate_from_visitors)));
        stageElement.appendChild(line);
        const track = node('div', 'funnel-track');
        const fill = node('div', 'funnel-fill');
        fill.style.width = Math.max(0, Math.min(100, Number(stage.rate_from_visitors) || 0)) + '%';
        track.appendChild(fill);
        stageElement.appendChild(track);
        body.appendChild(stageElement);
      });
      article.appendChild(body);
      elements.funnelsGrid.appendChild(article);
    });
  }

  function renderDashboard() {
    if (!report) return;
    elements.updatedAt.textContent = 'Atualizado em ' + formatDate(report.generated_at) + ', considerando os últimos ' + report.period_days + ' dias.';
    elements.dataQuality.textContent = formatNumber(report.data_quality.accepted_events) + ' eventos usados no relatório. ' + formatNumber(report.data_quality.ignored_records) + ' registros inválidos ignorados.';
    renderSummary();
    renderComparisons();
    renderTable();
    renderFunnels();
  }

  async function loadReport(options) {
    const settings = options || {};
    elements.dashboardStatus.textContent = '';
    elements.refreshButton.disabled = true;
    if (settings.initial) setVisible('loading');

    try {
      const result = await requestJson('/api/analytics/report?days=' + encodeURIComponent(elements.periodSelect.value));
      if (result.response.status === 401) {
        showLogin(settings.initial ? '' : 'Sua sessão expirou. Informe a senha novamente.');
        return;
      }
      if (!result.response.ok || !result.payload) {
        throw new Error(result.payload && result.payload.error ? result.payload.error : 'Não foi possível carregar o relatório.');
      }
      report = result.payload;
      setVisible('dashboard');
      renderDashboard();
    } catch (error) {
      if (settings.initial) {
        showLogin('O painel não respondeu. Tente entrar novamente.');
      } else {
        elements.dashboardStatus.textContent = error instanceof Error ? error.message : 'Não foi possível carregar o relatório.';
      }
    } finally {
      elements.refreshButton.disabled = false;
    }
  }

  elements.loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    elements.loginMessage.textContent = '';
    const submitButton = elements.loginForm.querySelector('button[type="submit"]');
    if (!elements.password.value || elements.password.value.length < 8) {
      elements.loginMessage.textContent = 'Informe a senha completa.';
      elements.password.focus();
      return;
    }

    submitButton.disabled = true;
    try {
      const result = await requestJson('/api/analytics/login', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: elements.password.value })
      });
      if (!result.response.ok) {
        throw new Error(result.payload && result.payload.error ? result.payload.error : 'Não foi possível entrar.');
      }
      elements.password.value = '';
      await loadReport();
    } catch (error) {
      elements.loginMessage.textContent = error instanceof Error ? error.message : 'Não foi possível entrar.';
      elements.password.select();
    } finally {
      submitButton.disabled = false;
    }
  });

  elements.logoutButton.addEventListener('click', async function () {
    elements.logoutButton.disabled = true;
    try {
      await requestJson('/api/analytics/logout', { method: 'POST' });
    } finally {
      elements.logoutButton.disabled = false;
      showLogin('Você saiu do painel.');
    }
  });

  elements.refreshButton.addEventListener('click', function () { loadReport(); });
  elements.periodSelect.addEventListener('change', function () { loadReport(); });
  elements.offerSelect.addEventListener('change', renderDashboard);

  loadReport({ initial: true });
})();
