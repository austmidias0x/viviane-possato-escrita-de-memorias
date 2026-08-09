import type {
  AnalyticsOffer,
  AnalyticsVariant,
  StoredAnalyticsEvent,
} from "./analytics-schema.mts";

const START_EVENTS = new Set([
  "quiz_start",
  "personalization_start",
  "mechanism_start",
  "form_start",
]);
const STEP_EVENTS = new Set([
  "quiz_step",
  "personalization_step",
  "mechanism_step",
  "stage_select",
  "stage_switch",
  "intent_select",
  "intent_switch",
  "qualification_select",
]);
const RESULT_EVENTS = new Set([
  "quiz_complete",
  "personalization_complete",
  "mechanism_complete",
  "application_qualification",
]);

export interface FunnelStage {
  key: string;
  label: string;
  visitors: number;
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
    engagement: number;
    start: number;
    start_to_result: number;
    result_to_conversion: number;
    visitor_to_conversion: number;
    qualification: number;
  };
}

export interface PageAnalytics extends AnalyticsMetrics {
  offer: AnalyticsOffer | "all";
  variant: AnalyticsVariant | "all";
  page_id: string;
  page_path: string;
  funnel: FunnelStage[];
}

export interface AnalyticsReport {
  period_days: 7 | 30 | 90;
  from: string;
  to: string;
  generated_at: string;
  totals: AnalyticsMetrics;
  offers: Record<AnalyticsOffer, AnalyticsMetrics>;
  pages: PageAnalytics[];
  comparisons: Array<{
    offer: AnalyticsOffer;
    h: PageAnalytics | null;
    i: PageAnalytics | null;
  }>;
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
  steps: Map<string, { label: string; visitors: Set<string>; firstSeenAt: number }>;
}

function createMutablePage(
  pageId: string,
  pagePath: string,
  offer: AnalyticsOffer | "all",
  variant: AnalyticsVariant | "all",
): MutablePage {
  return {
    offer,
    variant,
    page_id: pageId,
    page_path: pagePath,
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
    steps: new Map(),
  };
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function humanizeStep(value: string): string {
  const normalized = value
    .replace(/^(quiz|personalization|mechanism)[-_:]?/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!normalized) return "Etapa interativa";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function stepIdentity(event: StoredAnalyticsEvent): { key: string; label: string } {
  const value = event.step || event.next_step;
  if (value) return { key: value.toLowerCase(), label: humanizeStep(value) };
  if (event.event.startsWith("stage_")) {
    const stage = event.stage || "selecionado";
    return { key: `stage:${stage}`, label: `Estágio: ${humanizeStep(stage)}` };
  }
  if (event.event.startsWith("intent_")) {
    const intent = event.intent || "selecionada";
    return { key: `intent:${intent}`, label: `Intenção: ${humanizeStep(intent)}` };
  }
  return { key: event.event, label: "Etapa interativa" };
}

function applyEvent(target: MutablePage, event: StoredAnalyticsEvent): void {
  target.visitors.add(event.visitor_id);
  target.sessions.add(event.session_id);

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
    const identity = stepIdentity(event);
    const timestamp = Date.parse(event.occurred_at);
    const step = target.steps.get(identity.key) ?? {
      label: identity.label,
      visitors: new Set<string>(),
      firstSeenAt: Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER,
    };
    step.visitors.add(event.visitor_id);
    step.firstSeenAt = Math.min(
      step.firstSeenAt,
      Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER,
    );
    target.steps.set(identity.key, step);
  }

  if (event.event === "checkout_click") target.checkoutClicks.add(event.visitor_id);
  if (event.event === "form_submit_success") target.formSubmits.add(event.visitor_id);
  if (
    (event.offer === "memorias" && event.event === "checkout_click") ||
    (event.offer === "mentoria" && event.event === "qualified_lead")
  ) {
    target.conversions.add(event.visitor_id);
  }
  if (event.event === "qualified_lead") {
    target.qualifiedLeads.add(event.visitor_id);
  }
}

function finalizePage(page: MutablePage): PageAnalytics {
  const visitorCount = page.visitors.size;
  const resultDenominator = page.results.size || page.starts.size;
  const qualificationDenominator = page.formSubmits.size || page.results.size;
  const metrics: AnalyticsMetrics = {
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
      engagement: percentage(page.engaged.size, visitorCount),
      start: percentage(page.starts.size, visitorCount),
      start_to_result: percentage(page.results.size, page.starts.size),
      result_to_conversion: percentage(page.conversions.size, resultDenominator),
      visitor_to_conversion: percentage(page.conversions.size, visitorCount),
      qualification: percentage(page.qualifiedLeads.size, qualificationDenominator),
    },
  };

  const orderedStages: Array<{ key: string; label: string; visitors: number }> = [
    { key: "view", label: "Visitantes", visitors: visitorCount },
    { key: "start", label: "Início", visitors: page.starts.size },
    ...[...page.steps.entries()]
      .sort((left, right) => left[1].firstSeenAt - right[1].firstSeenAt || left[0].localeCompare(right[0]))
      .map(([key, step]) => ({ key: `step:${key}`, label: step.label, visitors: step.visitors.size })),
    { key: "result", label: "Resultado", visitors: page.results.size },
    { key: "conversion", label: "Conversão", visitors: page.conversions.size },
  ];

  const funnel = orderedStages.map((stage, index): FunnelStage => ({
    ...stage,
    rate_from_previous: index === 0 ? null : percentage(stage.visitors, orderedStages[index - 1].visitors),
    rate_from_visitors: percentage(stage.visitors, visitorCount),
  }));

  return {
    ...metrics,
    offer: page.offer,
    variant: page.variant,
    page_id: page.page_id,
    page_path: page.page_path,
    funnel,
  };
}

export function isStoredAnalyticsEvent(value: unknown): value is StoredAnalyticsEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const record = value as Partial<StoredAnalyticsEvent>;
  return (
    record.schema_version === 1 &&
    typeof record.event_id === "string" &&
    typeof record.occurred_at === "string" &&
    typeof record.event === "string" &&
    (record.offer === "memorias" || record.offer === "mentoria") &&
    typeof record.variant === "string" &&
    typeof record.page_id === "string" &&
    typeof record.page_path === "string" &&
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
  const totals = createMutablePage("all", "all", "all", "all");
  const offerTotals = {
    mentoria: createMutablePage("mentoria-all", "all", "mentoria", "all"),
    memorias: createMutablePage("memorias-all", "all", "memorias", "all"),
  };

  for (const event of filteredEvents) {
    const groupingKey = `${event.page_id}|${event.page_path}`;
    const page = pageMap.get(groupingKey) ?? createMutablePage(
      event.page_id,
      event.page_path,
      event.offer,
      event.variant,
    );
    applyEvent(page, event);
    applyEvent(totals, event);
    applyEvent(offerTotals[event.offer], event);
    pageMap.set(groupingKey, page);
  }

  const pages = [...pageMap.values()]
    .map(finalizePage)
    .sort((left, right) => left.offer.localeCompare(right.offer) || left.variant.localeCompare(right.variant));
  const pageById = new Map(pages.map((page) => [page.page_id, page]));

  return {
    period_days: periodDays,
    from: new Date(startTime).toISOString(),
    to: now.toISOString(),
    generated_at: now.toISOString(),
    totals: finalizePage(totals),
    offers: {
      mentoria: finalizePage(offerTotals.mentoria),
      memorias: finalizePage(offerTotals.memorias),
    },
    pages,
    comparisons: (["mentoria", "memorias"] as const).map((offer) => ({
      offer,
      h: pageById.get(`${offer}-h`) ?? null,
      i: pageById.get(`${offer}-i`) ?? null,
    })),
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
