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
    variantSelect: document.getElementById('variantSelect'),
    rateBasisSelect: document.getElementById('rateBasisSelect'),
    refreshButton: document.getElementById('refreshButton'),
    updatedAt: document.getElementById('updatedAt'),
    dashboardStatus: document.getElementById('dashboardStatus'),
    summaryCards: document.getElementById('summaryCards'),
    comparisonGrid: document.getElementById('comparisonGrid'),
    pagesTableBody: document.getElementById('pagesTableBody'),
    readingGrid: document.getElementById('readingGrid'),
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
    if (value === null || value === undefined) return 'Sem base';
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

  function currentPages(experimentOnly) {
    if (!report) return [];
    const offer = elements.offerSelect.value;
    const variant = elements.variantSelect.value;
    return report.pages.filter(function (page) {
      if (offer !== 'all' && page.offer !== offer) return false;
      if (variant !== 'all' && page.variant !== variant) return false;
      if (variant !== 'all' && !page.is_experiment_page) return false;
      if (experimentOnly) return page.is_experiment_page;
      return page.is_experiment_page || page.has_data;
    });
  }

  function currentMetrics() {
    if (!report) return null;
    const offer = elements.offerSelect.value;
    const variant = elements.variantSelect.value;
    if (offer === 'all' && variant === 'all') return report.totals;
    if (offer !== 'all' && variant === 'all') return report.offers[offer];
    if (offer === 'all') return report.variants[variant];
    return report.offer_variants[offer][variant];
  }

  function selectedRate(stage) {
    return elements.rateBasisSelect.value === 'visitors'
      ? stage.rate_from_visitors
      : stage.rate_from_previous;
  }

  function rateExplanation(stage) {
    if (!stage.applicable) return 'Não se aplica';
    if (elements.rateBasisSelect.value === 'visitors') return 'dos visitantes';
    if (!stage.denominator_label) return 'contagem da etapa';
    return 'de ' + stage.denominator_label.toLowerCase();
  }

  function renderSummary() {
    const metrics = currentMetrics();
    clear(elements.summaryCards);
    if (!metrics) return;

    const cards = [
      ['Visitantes', metrics.visitors, formatNumber(metrics.sessions) + ' sessões'],
      ['Visualizações', metrics.views, formatNumber(metrics.engaged_visitors) + ' visitantes engajados'],
      ['Experiências ou formulários iniciados', metrics.starts, formatPercent(metrics.rates.start) + ' dos visitantes'],
      ['Experiências ou avaliações concluídas', metrics.results, formatPercent(metrics.rates.start_to_result) + ' dos inícios'],
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

  function stageCell(stage, showLabel) {
    const cell = document.createElement('td');
    if (!stage || !stage.applicable) {
      cell.appendChild(node('span', 'not-applicable', 'Não se aplica'));
      return cell;
    }
    if (showLabel) cell.appendChild(node('span', 'stage-label', stage.label));
    cell.appendChild(node('strong', 'stage-value', formatNumber(stage.visitors)));
    if (stage.denominator_key) {
      cell.appendChild(node('span', 'stage-rate', formatPercent(selectedRate(stage)) + ' ' + rateExplanation(stage)));
    }
    return cell;
  }

  function renderComparisonCard(comparison) {
    const article = node('article', 'comparison-card comparison-card--matrix');
    const header = node('div', 'comparison-card-header');
    header.appendChild(node('h3', '', productName(comparison.offer)));
    header.appendChild(node('span', 'product-tag', 'A a I'));
    article.appendChild(header);

    const shell = node('div', 'matrix-shell');
    shell.tabIndex = 0;
    shell.setAttribute('aria-label', 'Tabela rolável com a comparação de ' + productName(comparison.offer));
    const table = document.createElement('table');
    table.className = 'matrix-table';
    const caption = node('caption', '', 'Comparação das etapas universais de ' + productName(comparison.offer));
    table.appendChild(caption);
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    const headers = ['Página', 'Visitantes', 'Engajados', 'Experiência iniciada', 'Experiência concluída'];
    if (comparison.offer === 'mentoria') headers.push('Diagnóstico enviado');
    headers.push(comparison.offer === 'memorias' ? 'Checkout aberto' : 'Lead qualificado');
    headers.forEach(function (label) {
      const cell = node('th', '', label);
      cell.scope = 'col';
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    const body = document.createElement('tbody');
    comparison.pages.forEach(function (page) {
      if (elements.variantSelect.value !== 'all' && page.variant !== elements.variantSelect.value) return;
      const row = document.createElement('tr');
      const pageCell = document.createElement('th');
      pageCell.scope = 'row';
      pageCell.appendChild(node('span', 'variant-tag', page.variant.toUpperCase()));
      pageCell.appendChild(node('span', 'page-path', page.page_path));
      row.appendChild(pageCell);
      page.comparison_funnel.filter(function (stage) {
        return comparison.offer === 'mentoria' || stage.key !== 'decision';
      }).forEach(function (stage, index) {
        if (index === 0) {
          const visitorsCell = document.createElement('td');
          visitorsCell.appendChild(node('strong', 'stage-value', formatNumber(stage.visitors)));
          row.appendChild(visitorsCell);
        } else {
          row.appendChild(stageCell(stage, index === 2 || index === 3));
        }
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    shell.appendChild(table);
    article.appendChild(shell);
    return article;
  }

  function renderComparisons() {
    clear(elements.comparisonGrid);
    if (!report) return;
    const selectedOffer = elements.offerSelect.value;
    report.comparisons.filter(function (comparison) {
      return selectedOffer === 'all' || comparison.offer === selectedOffer;
    }).forEach(function (comparison) {
      elements.comparisonGrid.appendChild(renderComparisonCard(comparison));
    });
  }

  function applicableDetailedStages(page) {
    return page.funnel.filter(function (stage) { return stage.applicable; });
  }

  function renderTable() {
    clear(elements.pagesTableBody);
    const pages = currentPages(false);
    if (pages.length === 0) {
      const row = document.createElement('tr');
      const cell = node('td', 'empty-copy', 'Ainda não há páginas para este filtro.');
      cell.colSpan = 8;
      row.appendChild(cell);
      elements.pagesTableBody.appendChild(row);
      return;
    }

    pages.forEach(function (page) {
      const stages = applicableDetailedStages(page);
      const conversion = stages.at(-1);
      const firstAction = stages[1] || null;
      const beforeConversion = stages.length > 2 ? stages.at(-2) : null;
      const row = document.createElement('tr');
      const pageCell = document.createElement('td');
      pageCell.appendChild(node('span', 'page-name', productName(page.offer) + ' ' + page.variant.toUpperCase()));
      pageCell.appendChild(node('span', 'page-path', page.page_path));
      if (!page.is_experiment_page) pageCell.appendChild(node('span', 'supplemental-tag', 'Rota complementar'));
      row.appendChild(pageCell);
      row.appendChild(node('td', '', formatNumber(page.visitors)));
      const engaged = page.comparison_funnel.find(function (stage) { return stage.key === 'engaged'; });
      row.appendChild(node('td', '', formatNumber(page.engaged_visitors) + ' · ' + formatPercent(engaged && engaged.rate_from_visitors)));
      row.appendChild(stageCell(firstAction, true));
      row.appendChild(stageCell(beforeConversion, true));
      row.appendChild(node('td', '', formatNumber(page.conversions)));
      row.appendChild(node('td', '', conversion ? formatPercent(conversion.rate_from_previous) : 'Sem base'));
      row.appendChild(node('td', '', conversion ? formatPercent(conversion.rate_from_visitors) : '0,0%'));
      elements.pagesTableBody.appendChild(row);
    });
  }

  function renderReading() {
    clear(elements.readingGrid);
    const pages = currentPages(true);
    if (!pages.length) {
      elements.readingGrid.appendChild(node('p', 'empty-copy', 'Ainda não há páginas para este filtro.'));
      return;
    }

    const offers = ['mentoria', 'memorias'];
    offers.forEach(function (offer) {
      const offerPages = pages.filter(function (page) { return page.offer === offer; });
      if (!offerPages.length) return;
      const article = node('article', 'reading-card');
      const header = node('div', 'comparison-card-header');
      header.appendChild(node('h3', '', productName(offer)));
      header.appendChild(node('span', 'product-tag', 'Posição observada'));
      article.appendChild(header);
      const shell = node('div', 'matrix-shell');
      shell.tabIndex = 0;
      shell.setAttribute('aria-label', 'Tabela rolável de profundidade observada de ' + productName(offer));
      const table = document.createElement('table');
      table.className = 'reading-table';
      table.appendChild(node('caption', '', 'Profundidade observada de ' + productName(offer)));
      const head = document.createElement('thead');
      const row = document.createElement('tr');
      ['Página', 'Visitantes', 'Engajados', '25%', '50%', '75%', '90%'].forEach(function (label) {
        const cell = node('th', '', label);
        cell.scope = 'col';
        row.appendChild(cell);
      });
      head.appendChild(row);
      table.appendChild(head);
      const body = document.createElement('tbody');
      offerPages.forEach(function (page) {
        const pageRow = document.createElement('tr');
        const pageCell = document.createElement('th');
        pageCell.scope = 'row';
        pageCell.appendChild(node('span', 'variant-tag', page.variant.toUpperCase()));
        pageRow.appendChild(pageCell);
        page.reading_funnel.forEach(function (stage, index) {
          if (index === 0) {
            pageRow.appendChild(node('td', '', formatNumber(stage.visitors)));
          } else {
            pageRow.appendChild(stageCell(stage, false));
          }
        });
        body.appendChild(pageRow);
      });
      table.appendChild(body);
      shell.appendChild(table);
      article.appendChild(shell);
      elements.readingGrid.appendChild(article);
    });
  }

  function renderFunnels() {
    clear(elements.funnelsGrid);
    const pages = currentPages(false);
    if (pages.length === 0) {
      elements.funnelsGrid.appendChild(node('p', 'empty-copy', 'Ainda não há páginas para este filtro.'));
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
      applicableDetailedStages(page).forEach(function (stage) {
        const stageElement = node('div', 'funnel-stage');
        const line = node('div', 'funnel-stage-line');
        line.appendChild(node('span', '', stage.label));
        const rateText = stage.denominator_key
          ? formatPercent(selectedRate(stage)) + ' ' + rateExplanation(stage)
          : 'Base da página';
        line.appendChild(node('span', '', formatNumber(stage.visitors) + ' · ' + rateText));
        stageElement.appendChild(line);
        const track = node('div', 'funnel-track');
        const fill = node('div', 'funnel-fill');
        const barRate = stage.denominator_key ? selectedRate(stage) : stage.rate_from_visitors;
        fill.style.width = Math.max(0, Math.min(100, Number(barRate) || 0)) + '%';
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
    renderReading();
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
  elements.variantSelect.addEventListener('change', renderDashboard);
  elements.rateBasisSelect.addEventListener('change', renderDashboard);

  loadReport({ initial: true });
})();
