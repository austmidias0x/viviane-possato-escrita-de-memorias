export const ANALYTICS_EVENTS = [
  "page_view",
  "engaged_view",
  "scroll_depth",
  "quiz_start",
  "quiz_step",
  "quiz_complete",
  "quiz_restart",
  "personalization_start",
  "personalization_step",
  "personalization_complete",
  "mechanism_start",
  "mechanism_step",
  "mechanism_complete",
  "mechanism_restart",
  "stage_select",
  "stage_switch",
  "intent_select",
  "intent_switch",
  "form_start",
  "form_submit_attempt",
  "form_submit_success",
  "form_submit_error",
  "application_qualification",
  "qualification_select",
  "qualified_lead",
  "checkout_click",
  "lead_cta_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsOffer = "memorias" | "mentoria";
export type AnalyticsVariant = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j";

export interface StoredAnalyticsEvent {
  schema_version: 1;
  event_id: string;
  occurred_at: string;
  event: AnalyticsEventName;
  offer: AnalyticsOffer;
  variant: AnalyticsVariant;
  page_id: string;
  page_path: string;
  visitor_id: string;
  session_id: string;
  segment?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  step?: string;
  next_step?: string;
  depth?: number;
  trigger?: string;
  form_name?: string;
  submission_source?: string;
  qualified?: boolean;
  stage?: string;
  intent?: string;
  previous_intent?: string;
  previous_stage?: string;
  label?: string;
  destination?: string;
  referrer?: string;
}

const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);
const ALLOWED_FIELDS = new Set([
  "event",
  "offer",
  "variant",
  "segment",
  "page_id",
  "page_path",
  "visitor_id",
  "session_id",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "step",
  "next_step",
  "depth",
  "trigger",
  "form_name",
  "submission_source",
  "qualified",
  "stage",
  "intent",
  "previous_intent",
  "previous_stage",
  "label",
  "destination",
  "referrer",
]);

const IDENTIFIER_PATTERN = /^[a-zA-Z0-9_-]{12,96}$/;
const LABEL_PATTERN = /^[\p{L}\p{N}\p{P}\p{Zs}]+$/u;
const CONTROL_OR_MARKUP_PATTERN = /[\p{C}<>]/u;
const EMAIL_PATTERN = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/iu;
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){9,}/;
const OFFER_SET = new Set<AnalyticsOffer>(["memorias", "mentoria"]);
const VARIANT_SET = new Set<AnalyticsVariant>(["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]);

type RecordValue = Record<string, unknown>;
type ParseResult =
  | { ok: true; event: StoredAnalyticsEvent }
  | { ok: false; error: string };

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPotentialPii(value: string): boolean {
  return EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value);
}

function hasPotentialUrlPii(pathname: string): boolean {
  let decodedPath = pathname;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  if (EMAIL_PATTERN.test(decodedPath)) return true;
  return decodedPath.split("/").some((segment) => {
    const compact = segment.replace(/[\s().+-]/g, "");
    return /^\d{9,15}$/.test(compact) && /^[\d\s().+-]+$/.test(segment);
  });
}

function optionalToken(value: unknown, maximumLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > maximumLength ||
    hasPotentialPii(normalized) ||
    CONTROL_OR_MARKUP_PATTERN.test(normalized)
  ) return undefined;
  return normalized;
}

function optionalStep(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 999) {
    return String(value);
  }
  return optionalToken(value, 80);
}

function optionalLabel(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  if (
    normalized.length === 0 ||
    normalized.length > 120 ||
    hasPotentialPii(normalized) ||
    !LABEL_PATTERN.test(normalized)
  ) return undefined;
  return normalized;
}

function optionalSanitizedUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > 1024) return undefined;

  try {
    const url = new URL(value, "https://vivianepossato.com");
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    const port = url.port ? `:${url.port}` : "";
    const sanitized = `${url.protocol}//${url.hostname}${port}${url.pathname}`.slice(0, 300);
    return hasPotentialUrlPii(url.pathname) ? undefined : sanitized;
  } catch {
    return undefined;
  }
}

function expectedPath(offer: AnalyticsOffer, variant: AnalyticsVariant): string {
  return variant === "a" ? `/${offer}/` : `/${offer}${variant}/`;
}

function normalizePagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const pathname = new URL(value, "https://vivianepossato.com").pathname.toLowerCase();
    return pathname.endsWith("/") ? pathname : `${pathname}/`;
  } catch {
    return null;
  }
}

function assignOptionalString(
  target: StoredAnalyticsEvent,
  source: RecordValue,
  key: keyof StoredAnalyticsEvent,
  sanitizer: (value: unknown) => string | undefined,
): void {
  const value = sanitizer(source[key]);
  if (value !== undefined) Object.assign(target, { [key]: value });
}

export function parseAnalyticsEvent(value: unknown, now = new Date()): ParseResult {
  if (!isRecord(value)) return { ok: false, error: "O corpo precisa ser um objeto JSON." };

  const unknownField = Object.keys(value).find((key) => !ALLOWED_FIELDS.has(key));
  if (unknownField) return { ok: false, error: `Campo não permitido: ${unknownField}.` };

  if (typeof value.event !== "string" || !EVENT_SET.has(value.event)) {
    return { ok: false, error: "Evento não permitido." };
  }

  const offer = typeof value.offer === "string" ? value.offer.toLowerCase() as AnalyticsOffer : null;
  const variant = typeof value.variant === "string" ? value.variant.toLowerCase() as AnalyticsVariant : null;
  if (!offer || !OFFER_SET.has(offer)) return { ok: false, error: "Oferta inválida." };
  if (!variant || !VARIANT_SET.has(variant)) return { ok: false, error: "Variação inválida." };

  const expectedPageId = `${offer}-${variant}`;
  if (value.page_id !== expectedPageId) return { ok: false, error: "Identificador de página inválido." };

  const pagePath = normalizePagePath(value.page_path);
  const isMemoriasHome = offer === "memorias" && variant === "a" && pagePath === "/";
  if (!isMemoriasHome && pagePath !== expectedPath(offer, variant)) {
    return { ok: false, error: "Rota de página inválida." };
  }

  if (typeof value.visitor_id !== "string" || !IDENTIFIER_PATTERN.test(value.visitor_id)) {
    return { ok: false, error: "Identificador anônimo de visitante inválido." };
  }
  if (typeof value.session_id !== "string" || !IDENTIFIER_PATTERN.test(value.session_id)) {
    return { ok: false, error: "Identificador anônimo de sessão inválido." };
  }

  const normalized: StoredAnalyticsEvent = {
    schema_version: 1,
    event_id: crypto.randomUUID(),
    occurred_at: now.toISOString(),
    event: value.event as AnalyticsEventName,
    offer,
    variant,
    page_id: expectedPageId,
    page_path: pagePath,
    visitor_id: value.visitor_id,
    session_id: value.session_id,
  };

  const tokenFields: Array<[keyof StoredAnalyticsEvent, number]> = [
    ["segment", 64],
    ["utm_source", 120],
    ["utm_medium", 120],
    ["utm_campaign", 160],
    ["utm_content", 160],
    ["utm_term", 160],
    ["trigger", 80],
    ["form_name", 80],
    ["submission_source", 40],
    ["stage", 80],
    ["intent", 80],
    ["previous_intent", 80],
    ["previous_stage", 80],
  ];

  for (const [key, maximumLength] of tokenFields) {
    assignOptionalString(normalized, value, key, (input) => optionalToken(input, maximumLength));
  }
  assignOptionalString(normalized, value, "step", optionalStep);
  assignOptionalString(normalized, value, "next_step", optionalStep);

  assignOptionalString(normalized, value, "label", optionalLabel);
  for (const key of ["destination", "referrer"] as const) {
    assignOptionalString(normalized, value, key, optionalSanitizedUrl);
  }

  if (value.depth !== undefined) {
    if (typeof value.depth === "number" && [25, 50, 75, 90, 100].includes(value.depth)) {
      normalized.depth = value.depth;
    }
  }

  if (value.qualified !== undefined) {
    if (typeof value.qualified === "boolean") normalized.qualified = value.qualified;
  }

  if (normalized.event === "qualified_lead" && normalized.qualified !== true) {
    return { ok: false, error: "Um lead qualificado precisa conter qualified=true." };
  }

  return { ok: true, event: normalized };
}

export function analyticsBlobKey(event: StoredAnalyticsEvent): string {
  const day = event.occurred_at.slice(0, 10);
  const sortableTime = event.occurred_at.slice(11).replace(/[:.Z]/g, "");
  return `${day}/${sortableTime}-${event.event_id}.json`;
}
