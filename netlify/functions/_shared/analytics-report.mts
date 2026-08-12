import {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsOffer,
  type AnalyticsVariant,
  type StoredAnalyticsEvent,
} from "./analytics-schema.mts";

const VARIANTS: AnalyticsVariant[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
const OFFERS: AnalyticsOffer[] = ["mentoria", "memorias"];
const ANALYTICS_EVENT_SET = new Set<AnalyticsEventName>(ANALYTICS_EVENTS);
const START_EVENTS = new Set<AnalyticsEventName>([
  "quiz_start",
  "personalization_start",
  "mechanism_start",
  "form_start",
]);
const STEP_EVENTS = new Set<AnalyticsEventName>([
  "quiz_step",
  "personalization_step",
  "mechanism_step",
  "stage_select",
  "stage_switch",
  "intent_select",
  "intent_switch",
  "qualification_select",
]);
const RESULT_EVENTS = new Set<AnalyticsEventName>([
  "quiz_complete",
  "personalization_complete",
  "mechanism_complete",
  "application_qualification",
]);

export interface FunnelStage {
  key: string;
  label: string;
  visitors: number;
  applicable: boolean;
  denominator_key: string | null;
  denominator_label: string | null;
  denominator_visitors: number | null;
  rate_from_previous: number | null;
  rate_from_visitors: number;
}

export interface AnalyticsMetrics {
  visitors: number;
  sessions: number;
  views: number;
  engaged_visitors: number;
  starts: number;
  step_visitors: number;
  step_events: number;
  results: number;
  checkout_clicks: number;
  form_submits: number;
  conversions: number;
  qualified_leads: number;
  rates: {
    engagement: number | null;
    start: number | null;
    start_to_result: number | null;
    result_to_conversion: number | null;
    visitor_to_conversion: number | null;
    qualification: number | null;
  };
}

export interface PageAnalytics extends AnalyticsMetrics {
  offer: AnalyticsOffer | "all";
  variant: AnalyticsVariant | "all";
  page_id: string;
  page_path: string;
  has_data: boolean;
  is_experiment_page: boolean;
  comparison_funnel: FunnelStage[];
  reading_funnel: FunnelStage[];
  funnel: FunnelStage[];
}

export interface AnalyticsReport {
  period_days: 7 | 30 | 90;
  from: string;
  to: string;
  generated_at: string;
  totals: AnalyticsMetrics;
  offers: Record<AnalyticsOffer, AnalyticsMetrics>;
  variants: Record<AnalyticsVariant, AnalyticsMetrics>;
  offer_variants: Record<AnalyticsOffer, Record<AnalyticsVariant, AnalyticsMetrics>>;
  pages: PageAnalytics[];
  comparisons: Array<{
    offer: AnalyticsOffer;
    pages: PageAnalytics[];
  }>;
  filters: {
    offers: AnalyticsOffer[];
    variants: AnalyticsVariant[];
  };
  data_quality: {
    accepted_events: number;
    ignored_records: number;
  };
}

interface MutablePage {
  offer: AnalyticsOffer | "all";
  variant: AnalyticsVariant | "all";
  page_id: string;
  page_path: string;
  isExperimentPage: boolean;
  visitors: Set<string>;
  sessions: Set<string>;
  viewVisitors: Set<string>;
  views: number;
  engaged: Set<string>;
  starts: Set<string>;
  stepVisitors: Set<string>;
  stepEvents: number;
  results: Set<string>;
  checkoutClicks: Set<string>;
  formSubmits: Set<string>;
  conversions: Set<string>;
  qualifiedLeads: Set<string>;
  eventVisitors: Map<AnalyticsEventName, Set<string>>;
  eventSteps: Map<string, Set<string>>;
  scrollDepths: Map<number, Set<string>>;
}

interface RawStage {
  key: string;
  label: string;
  visitors: number;
  applicable?: boolean;
  denominatorKey?: string | null;
}

interface ExperienceDefinition {
  startEvent?: AnalyticsEventName;
  startLabel?: string;
  completeEvent?: AnalyticsEventName;
  completeLabel?: string;
  decisionRequiresCompletion: boolean;
}

function canonicalPath(offer: AnalyticsOffer, variant: AnalyticsVariant): string {
  return variant === "a" ? `/${offer}/` : `/${offer}${variant}/`;
}

function createMutablePage(
  pageId: string,
  pagePath: string,
  offer: AnalyticsOffer | "all",
  variant: AnalyticsVariant | "all",
  isExperimentPage = false,
): MutablePage {
  return {
    offer,
    variant,
    page_id: pageId,
    page_path: pagePath,
    isExperimentPage,
    visitors: new Set(),
    sessions: new Set(),
    viewVisitors: new Set(),
    views: 0,
    engaged: new Set(),
    starts: new Set(),
    stepVisitors: new Set(),
    stepEvents: 0,
    results: new Set(),
    checkoutClicks: new Set(),
    formSubmits: new Set(),
    conversions: new Set(),
    qualifiedLeads: new Set(),
    eventVisitors: new Map(),
    eventSteps: new Map(),
    scrollDepths: new Map(),
  };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function percentageOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? percentage(numerator, denominator) : null;
}

function normalizedStep(value: string | undefined): string {
  return String(value || "").trim().toLowerCase();
}

function eventStepKey(event: AnalyticsEventName, step: string): string {
  return `${event}|${normalizedStep(step)}`;
}

function addVisitor(map: Map<AnalyticsEventName, Set<string>>, event: AnalyticsEventName, visitorId: string): void {
  const visitors = map.get(event) ?? new Set<string>();
  visitors.add(visitorId);
  map.set(event, visitors);
}

function addStepVisitor(
  map: Map<string, Set<string>>,
  event: AnalyticsEventName,
  step: string,
  visitorId: string,
): void {
  const key = eventStepKey(event, step);
  const visitors = map.get(key) ?? new Set<string>();
  visitors.add(visitorId);
  map.set(key, visitors);
}

function applyEvent(target: MutablePage, event: StoredAnalyticsEvent): void {
  target.visitors.add(event.visitor_id);
  target.sessions.add(event.session_id);
  addVisitor(target.eventVisitors, event.event, event.visitor_id);

  if (event.event === "page_view") {
    target.views += 1;
    target.viewVisitors.add(event.visitor_id);
  }
  if (event.event === "engaged_view") target.engaged.add(event.visitor_id);
  if (START_EVENTS.has(event.event)) target.starts.add(event.visitor_id);
  if (RESULT_EVENTS.has(event.event)) target.results.add(event.visitor_id);

  if (STEP_EVENTS.has(event.event)) {
    target.stepVisitors.add(event.visitor_id);
    target.stepEvents += 1;
    const step = event.step || event.next_step;
    if (step) addStepVisitor(target.eventSteps, event.event, step, event.visitor_id);
  }

  if (event.event === "scroll_depth" && event.depth) {
    const visitors = target.scrollDepths.get(event.depth) ?? new Set<string>();
    visitors.add(event.visitor_id);
    target.scrollDepths.set(event.depth, visitors);
  }
  if (event.event === "checkout_click") target.checkoutClicks.add(event.visitor_id);
  if (event.event === "form_submit_success") target.formSubmits.add(event.visitor_id);
  if (
    (event.offer === "memorias" && event.event === "checkout_click") ||
    (event.offer === "mentoria" && event.event === "qualified_lead")
  ) {
    target.conversions.add(event.visitor_id);
  }
  if (event.event === "qualified_lead") target.qualifiedLeads.add(event.visitor_id);
}

function eventCount(page: MutablePage, ...events: AnalyticsEventName[]): number {
  const visitors = new Set<string>();
  for (const event of events) {
    page.eventVisitors.get(event)?.forEach((visitor) => visitors.add(visitor));
  }
  return visitors.size;
}

function stepCount(page: MutablePage, event: AnalyticsEventName, ...steps: string[]): number {
  const visitors = new Set<string>();
  for (const step of steps) {
    page.eventSteps.get(eventStepKey(event, step))?.forEach((visitor) => visitors.add(visitor));
  }
  return visitors.size;
}

function finalizeStages(rawStages: RawStage[], visitorCount: number): FunnelStage[] {
  const counts = new Map(rawStages.map((stage) => [stage.key, stage.visitors]));
  const labels = new Map(rawStages.map((stage) => [stage.key, stage.label]));

  return rawStages.map((stage, index) => {
    const applicable = stage.applicable !== false;
    const denominatorKey = stage.denominatorKey === undefined
      ? (index === 0 ? null : rawStages[index - 1].key)
      : stage.denominatorKey;
    const denominatorVisitors = denominatorKey ? counts.get(denominatorKey) ?? 0 : null;
    return {
      key: stage.key,
      label: stage.label,
      visitors: stage.visitors,
      applicable,
      denominator_key: denominatorKey,
      denominator_label: denominatorKey ? labels.get(denominatorKey) ?? denominatorKey : null,
      denominator_visitors: denominatorVisitors,
      rate_from_previous: applicable && denominatorVisitors !== null && denominatorVisitors > 0
        ? percentage(stage.visitors, denominatorVisitors)
        : null,
      rate_from_visitors: applicable ? percentage(stage.visitors, visitorCount) : 0,
    };
  });
}

function experienceDefinition(page: MutablePage): ExperienceDefinition {
  if (page.variant === "d") {
    return {
      startEvent: "quiz_start",
      startLabel: "Quiz iniciado",
      completeEvent: "quiz_complete",
      completeLabel: "Resultado do quiz",
      decisionRequiresCompletion: page.offer === "mentoria",
    };
  }
  if (page.variant === "e") {
    return {
      startEvent: "mechanism_start",
      startLabel: "Demonstração iniciada",
      completeEvent: "mechanism_complete",
      completeLabel: "Demonstração concluída",
      decisionRequiresCompletion: false,
    };
  }
  if (page.variant === "f") {
    return page.offer === "memorias"
      ? {
          startEvent: "intent_select",
          startLabel: "Intenção escolhida",
          decisionRequiresCompletion: false,
        }
      : {
          startEvent: "stage_select",
          startLabel: "Estágio escolhido",
          decisionRequiresCompletion: false,
        };
  }
  if (page.variant === "h") {
    return {
      startEvent: "quiz_start",
      startLabel: "Quiz iniciado",
      completeEvent: "quiz_complete",
      completeLabel: "Copy personalizada liberada",
      decisionRequiresCompletion: true,
    };
  }
  if (page.variant === "i") {
    return {
      startEvent: "personalization_start",
      startLabel: "Experiência iniciada",
      completeEvent: "personalization_complete",
      completeLabel: "Síntese personalizada liberada",
      decisionRequiresCompletion: false,
    };
  }
  return { decisionRequiresCompletion: false };
}

function buildComparisonFunnel(page: MutablePage): FunnelStage[] {
  const visitors = page.visitors.size;
  const experience = experienceDefinition(page);
  const startCount = experience.startEvent ? eventCount(page, experience.startEvent) : 0;
  const completeCount = experience.completeEvent ? eventCount(page, experience.completeEvent) : 0;
  const decisionCount = page.offer === "mentoria" ? page.formSubmits.size : 0;
  const decisionLabel = "Diagnóstico enviado";
  const decisionBase = experience.completeEvent && experience.decisionRequiresCompletion
    ? "experience_complete"
    : "visitors";

  return finalizeStages([
    { key: "visitors", label: "Visitantes", visitors },
    {
      key: "engaged",
      label: "Engajados",
      visitors: page.engaged.size,
      denominatorKey: "visitors",
    },
    {
      key: "experience_start",
      label: experience.startLabel || "Experiência iniciada",
      visitors: startCount,
      applicable: Boolean(experience.startEvent),
      denominatorKey: "visitors",
    },
    {
      key: "experience_complete",
      label: experience.completeLabel || "Experiência concluída",
      visitors: completeCount,
      applicable: Boolean(experience.completeEvent),
      denominatorKey: experience.startEvent ? "experience_start" : null,
    },
    {
      key: "decision",
      label: decisionLabel,
      visitors: decisionCount,
      applicable: page.offer === "mentoria",
      denominatorKey: decisionBase,
    },
    {
      key: "conversion",
      label: page.offer === "memorias" ? "Checkout aberto" : "Lead qualificado",
      visitors: page.conversions.size,
      denominatorKey: page.offer === "memorias" ? decisionBase : "decision",
    },
  ], visitors);
}

function buildReadingFunnel(page: MutablePage): FunnelStage[] {
  return finalizeStages([
    { key: "visitors", label: "Visitantes", visitors: page.visitors.size },
    { key: "engaged", label: "Engajados", visitors: page.engaged.size, denominatorKey: "visitors" },
    { key: "scroll_25", label: "Rolagem 25%", visitors: page.scrollDepths.get(25)?.size ?? 0, denominatorKey: "visitors" },
    { key: "scroll_50", label: "Rolagem 50%", visitors: page.scrollDepths.get(50)?.size ?? 0, denominatorKey: "scroll_25" },
    { key: "scroll_75", label: "Rolagem 75%", visitors: page.scrollDepths.get(75)?.size ?? 0, denominatorKey: "scroll_50" },
    { key: "scroll_90", label: "Rolagem 90%", visitors: page.scrollDepths.get(90)?.size ?? 0, denominatorKey: "scroll_75" },
  ], page.visitors.size);
}

function quizDetailedStages(page: MutablePage): RawStage[] {
  const stages: RawStage[] = [
    { key: "start", label: "Quiz iniciado", visitors: eventCount(page, "quiz_start"), denominatorKey: "visitors" },
  ];

  if (page.variant === "d") {
    const steps = [
      ["q2", "Pergunta 1 respondida"],
      ["q3", "Pergunta 2 respondida"],
      ["bridge", "Pergunta 3 respondida"],
      ["q4", "Orientação intermediária lida"],
      ["q5", "Pergunta 4 respondida"],
      ["q6", "Pergunta 5 respondida"],
    ] as const;
    let parent = "start";
    for (const [step, label] of steps) {
      const key = `step_${step}`;
      stages.push({
        key,
        label,
        visitors: stepCount(page, "quiz_step", step),
        denominatorKey: parent,
      });
      parent = key;
    }
    stages.push({
      key: "result",
      label: "Resultado liberado",
      visitors: eventCount(page, "quiz_complete"),
      denominatorKey: parent,
    });
    return stages;
  }

  if (page.variant === "h") {
    const count = page.offer === "mentoria" ? 4 : 3;
    let parent = "start";
    for (let index = 1; index <= count; index += 1) {
      const key = `question_${index}`;
      stages.push({
        key,
        label: `Pergunta ${index} respondida`,
        visitors: stepCount(page, "quiz_step", String(index)),
        denominatorKey: parent,
      });
      parent = key;
    }
    stages.push({
      key: "result",
      label: "Copy personalizada liberada",
      visitors: eventCount(page, "quiz_complete"),
      denominatorKey: parent,
    });
  }
  return stages;
}

function mechanismDetailedStages(page: MutablePage): RawStage[] {
  return [
    { key: "start", label: "Demonstração iniciada", visitors: eventCount(page, "mechanism_start"), denominatorKey: "visitors" },
    { key: "step_2", label: "Etapa 2 aberta", visitors: stepCount(page, "mechanism_step", "2"), denominatorKey: "start" },
    { key: "step_3", label: "Etapa 3 aberta", visitors: stepCount(page, "mechanism_step", "3"), denominatorKey: "step_2" },
    { key: "result", label: "Demonstração concluída", visitors: eventCount(page, "mechanism_complete"), denominatorKey: "step_3" },
  ];
}

function personalizationDetailedStages(page: MutablePage): RawStage[] {
  const keys = page.offer === "memorias"
    ? [["semente", "Semente escolhida"], ["detalhe", "Detalhe escolhido"], ["intencao", "Intenção escolhida"], ["estagio", "Estágio escolhido"]]
    : [["origem", "Origem escolhida"], ["estagio", "Estágio escolhido"], ["decisao", "Decisão escolhida"], ["apoio", "Apoio escolhido"]];
  const stages: RawStage[] = [
    { key: "start", label: "Experiência iniciada", visitors: eventCount(page, "personalization_start"), denominatorKey: "visitors" },
  ];
  let parent = "start";
  for (const [step, label] of keys) {
    const key = `step_${step}`;
    stages.push({
      key,
      label,
      visitors: stepCount(page, "personalization_step", step),
      denominatorKey: parent,
    });
    parent = key;
  }
  stages.push({
    key: "result",
    label: "Síntese personalizada liberada",
    visitors: eventCount(page, "personalization_complete"),
    denominatorKey: parent,
  });
  return stages;
}

function applicationStages(page: MutablePage, parentKey: string): RawStage[] {
  const includeFormStart = page.variant !== "d";
  const stages: RawStage[] = [];
  let parent = parentKey;
  if (includeFormStart) {
    stages.push({
      key: "form_start",
      label: "Formulário iniciado",
      visitors: eventCount(page, "form_start"),
      denominatorKey: parent,
    });
    parent = "form_start";
  }
  if (page.variant === "i") {
    stages.push({
      key: "financial_answer",
      label: "Disponibilidade informada",
      visitors: eventCount(page, "qualification_select"),
      denominatorKey: parent,
    });
    parent = "financial_answer";
  }
  stages.push(
    {
      key: "form_attempt",
      label: "Envio solicitado",
      visitors: eventCount(page, "form_submit_attempt"),
      denominatorKey: parent,
    },
    {
      key: "form_success",
      label: "Diagnóstico enviado",
      visitors: page.formSubmits.size,
      denominatorKey: "form_attempt",
    },
    {
      key: "conversion",
      label: "Lead qualificado",
      visitors: page.conversions.size,
      denominatorKey: "form_success",
    },
  );
  return stages;
}

function buildDetailedFunnel(page: MutablePage): FunnelStage[] {
  const stages: RawStage[] = [
    { key: "visitors", label: "Visitantes", visitors: page.visitors.size },
  ];

  if (page.variant === "d" || page.variant === "h") {
    stages.push(...quizDetailedStages(page));
  } else if (page.variant === "e") {
    stages.push(...mechanismDetailedStages(page));
  } else if (page.variant === "f") {
    const event = page.offer === "memorias" ? "intent_select" : "stage_select";
    stages.push({
      key: "selection",
      label: page.offer === "memorias" ? "Intenção escolhida" : "Estágio escolhido",
      visitors: eventCount(page, event),
      denominatorKey: "visitors",
    });
  } else if (page.variant === "i") {
    stages.push(...personalizationDetailedStages(page));
  }

  if (page.offer === "memorias") {
    const experience = experienceDefinition(page);
    const checkoutBase = experience.completeEvent && experience.decisionRequiresCompletion
      ? "result"
      : "visitors";
    stages.push({
      key: "conversion",
      label: "Checkout aberto",
      visitors: page.checkoutClicks.size,
      denominatorKey: checkoutBase,
    });
  } else {
    const experience = experienceDefinition(page);
    const applicationBase = experience.completeEvent && experience.decisionRequiresCompletion
      ? "result"
      : "visitors";
    stages.push(...applicationStages(page, applicationBase));
  }

  return finalizeStages(stages, page.visitors.size);
}

function finalizeMetrics(page: MutablePage): AnalyticsMetrics {
  const visitorCount = page.visitors.size;
  const resultDenominator = page.results.size || page.starts.size;
  const qualificationDenominator = page.formSubmits.size || page.results.size;
  return {
    visitors: visitorCount,
    sessions: page.sessions.size,
    views: page.views,
    engaged_visitors: page.engaged.size,
    starts: page.starts.size,
    step_visitors: page.stepVisitors.size,
    step_events: page.stepEvents,
    results: page.results.size,
    checkout_clicks: page.checkoutClicks.size,
    form_submits: page.formSubmits.size,
    conversions: page.conversions.size,
    qualified_leads: page.qualifiedLeads.size,
    rates: {
      engagement: percentageOrNull(page.engaged.size, visitorCount),
      start: percentageOrNull(page.starts.size, visitorCount),
      start_to_result: percentageOrNull(page.results.size, page.starts.size),
      result_to_conversion: percentageOrNull(page.conversions.size, resultDenominator),
      visitor_to_conversion: percentageOrNull(page.conversions.size, visitorCount),
      qualification: percentageOrNull(page.qualifiedLeads.size, qualificationDenominator),
    },
  };
}

function finalizePage(page: MutablePage): PageAnalytics {
  return {
    ...finalizeMetrics(page),
    offer: page.offer,
    variant: page.variant,
    page_id: page.page_id,
    page_path: page.page_path,
    has_data: page.visitors.size > 0,
    is_experiment_page: page.isExperimentPage,
    comparison_funnel: buildComparisonFunnel(page),
    reading_funnel: buildReadingFunnel(page),
    funnel: buildDetailedFunnel(page),
  };
}

function createVariantMap(): Record<AnalyticsVariant, MutablePage> {
  return Object.fromEntries(VARIANTS.map((variant) => [
    variant,
    createMutablePage(`all-${variant}`, "all", "all", variant),
  ])) as Record<AnalyticsVariant, MutablePage>;
}

function createOfferVariantMap(): Record<AnalyticsOffer, Record<AnalyticsVariant, MutablePage>> {
  return Object.fromEntries(OFFERS.map((offer) => [
    offer,
    Object.fromEntries(VARIANTS.map((variant) => [
      variant,
      createMutablePage(`${offer}-${variant}`, canonicalPath(offer, variant), offer, variant),
    ])),
  ])) as Record<AnalyticsOffer, Record<AnalyticsVariant, MutablePage>>;
}

export function isStoredAnalyticsEvent(value: unknown): value is StoredAnalyticsEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Partial<StoredAnalyticsEvent>;
  const offer = record.offer;
  const variant = record.variant;
  if ((offer !== "memorias" && offer !== "mentoria") || !variant || !VARIANTS.includes(variant)) return false;
  const expectedPageId = `${offer}-${variant}`;
  const expectedPagePath = canonicalPath(offer, variant);
  const isMemoriasHome = offer === "memorias" && variant === "a" && record.page_path === "/";
  return (
    record.schema_version === 1 &&
    typeof record.event_id === "string" &&
    typeof record.occurred_at === "string" &&
    typeof record.event === "string" &&
    ANALYTICS_EVENT_SET.has(record.event as AnalyticsEventName) &&
    record.page_id === expectedPageId &&
    (record.page_path === expectedPagePath || isMemoriasHome) &&
    typeof record.visitor_id === "string" &&
    typeof record.session_id === "string"
  );
}

export function buildAnalyticsReport(
  events: StoredAnalyticsEvent[],
  periodDays: 7 | 30 | 90,
  now = new Date(),
  ignoredRecords = 0,
): AnalyticsReport {
  const startTime = now.getTime() - periodDays * 24 * 60 * 60 * 1000;
  const filteredEvents = events.filter((event) => {
    const time = Date.parse(event.occurred_at);
    return Number.isFinite(time) && time >= startTime && time <= now.getTime();
  });

  const pageMap = new Map<string, MutablePage>();
  for (const offer of OFFERS) {
    for (const variant of VARIANTS) {
      const path = canonicalPath(offer, variant);
      pageMap.set(`${offer}-${variant}|${path}`, createMutablePage(
        `${offer}-${variant}`,
        path,
        offer,
        variant,
        true,
      ));
    }
  }

  const totals = createMutablePage("all", "all", "all", "all");
  const offerTotals = {
    mentoria: createMutablePage("mentoria-all", "all", "mentoria", "all"),
    memorias: createMutablePage("memorias-all", "all", "memorias", "all"),
  };
  const variantTotals = createVariantMap();
  const offerVariantTotals = createOfferVariantMap();

  for (const event of filteredEvents) {
    const groupingKey = `${event.page_id}|${event.page_path}`;
    const page = pageMap.get(groupingKey) ?? createMutablePage(
      event.page_id,
      event.page_path,
      event.offer,
      event.variant,
      false,
    );
    applyEvent(page, event);
    applyEvent(totals, event);
    applyEvent(offerTotals[event.offer], event);
    if (event.page_path === canonicalPath(event.offer, event.variant)) {
      applyEvent(variantTotals[event.variant], event);
      applyEvent(offerVariantTotals[event.offer][event.variant], event);
    }
    pageMap.set(groupingKey, page);
  }

  const pages = [...pageMap.values()]
    .map(finalizePage)
    .sort((left, right) => {
      const offerOrder = OFFERS.indexOf(left.offer as AnalyticsOffer) - OFFERS.indexOf(right.offer as AnalyticsOffer);
      if (offerOrder !== 0) return offerOrder;
      const variantOrder = VARIANTS.indexOf(left.variant as AnalyticsVariant) - VARIANTS.indexOf(right.variant as AnalyticsVariant);
      if (variantOrder !== 0) return variantOrder;
      return left.page_path.localeCompare(right.page_path);
    });
  const canonicalPages = pages.filter((page) => page.is_experiment_page);

  return {
    period_days: periodDays,
    from: new Date(startTime).toISOString(),
    to: now.toISOString(),
    generated_at: now.toISOString(),
    totals: finalizeMetrics(totals),
    offers: {
      mentoria: finalizeMetrics(offerTotals.mentoria),
      memorias: finalizeMetrics(offerTotals.memorias),
    },
    variants: Object.fromEntries(VARIANTS.map((variant) => [
      variant,
      finalizeMetrics(variantTotals[variant]),
    ])) as Record<AnalyticsVariant, AnalyticsMetrics>,
    offer_variants: Object.fromEntries(OFFERS.map((offer) => [
      offer,
      Object.fromEntries(VARIANTS.map((variant) => [
        variant,
        finalizeMetrics(offerVariantTotals[offer][variant]),
      ])),
    ])) as Record<AnalyticsOffer, Record<AnalyticsVariant, AnalyticsMetrics>>,
    pages,
    comparisons: OFFERS.map((offer) => ({
      offer,
      pages: canonicalPages.filter((page) => page.offer === offer),
    })),
    filters: {
      offers: [...OFFERS],
      variants: [...VARIANTS],
    },
    data_quality: {
      accepted_events: filteredEvents.length,
      ignored_records: ignoredRecords,
    },
  };
}

export function utcDatePrefixes(periodDays: 7 | 30 | 90, now = new Date()): string[] {
  const start = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const prefixes: string[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    prefixes.push(`${cursor.toISOString().slice(0, 10)}/`);
  }
  return prefixes;
}
