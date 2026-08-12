export const META_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "InitiateCheckout",
  "Lead",
  "QuizStart",
  "QuizStep",
  "QuizComplete",
  "PersonalizationStart",
  "PersonalizationStep",
  "PersonalizedResult",
  "ExperienceStart",
  "ExperienceStep",
  "ExperienceComplete",
  "ApplicationStart",
  "QualifiedLead",
] as const;

export type MetaEventName = (typeof META_EVENT_NAMES)[number];

export interface MetaBrowserEvent {
  event_name: MetaEventName;
  event_id: string;
  event_source_url: string;
  fbp?: string;
  fbc?: string;
}

type ParseResult =
  | { ok: true; event: MetaBrowserEvent }
  | { ok: false; error: string };

const EVENT_SET = new Set<string>(META_EVENT_NAMES);
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]{12,128}$/;
const FBP_PATTERN = /^fb\.1\.\d{10,16}\.[a-zA-Z0-9_-]{1,128}$/;
const FBC_PATTERN = /^fb\.1\.\d{10,16}\.[a-zA-Z0-9_-]{1,256}$/;
const ALLOWED_FIELDS = new Set(["event_name", "event_id", "event_source_url", "fbp", "fbc"]);

function optionalCookie(value: unknown, pattern: RegExp): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return pattern.test(normalized) ? normalized : undefined;
}

function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || (hostname !== "vivianepossato.com" && !hostname.endsWith(".vivianepossato.com"))) {
      return null;
    }
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

export function parseMetaBrowserEvent(value: unknown): ParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "O corpo precisa ser um objeto JSON." };
  }

  const input = value as Record<string, unknown>;
  const unknownField = Object.keys(input).find((key) => !ALLOWED_FIELDS.has(key));
  if (unknownField) return { ok: false, error: `Campo não permitido: ${unknownField}.` };
  if (typeof input.event_name !== "string" || !EVENT_SET.has(input.event_name)) {
    return { ok: false, error: "Evento não permitido." };
  }
  if (typeof input.event_id !== "string" || !EVENT_ID_PATTERN.test(input.event_id)) {
    return { ok: false, error: "Identificador de evento inválido." };
  }
  const eventSourceUrl = sourceUrl(input.event_source_url);
  if (!eventSourceUrl) return { ok: false, error: "URL de origem inválida." };

  return {
    ok: true,
    event: {
      event_name: input.event_name as MetaEventName,
      event_id: input.event_id,
      event_source_url: eventSourceUrl,
      fbp: optionalCookie(input.fbp, FBP_PATTERN),
      fbc: optionalCookie(input.fbc, FBC_PATTERN),
    },
  };
}

export function clientIp(request: Request): string | undefined {
  const netlifyIp = request.headers.get("x-nf-client-connection-ip")?.trim();
  if (netlifyIp) return netlifyIp.slice(0, 64);
  return request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim().slice(0, 64) || undefined;
}
