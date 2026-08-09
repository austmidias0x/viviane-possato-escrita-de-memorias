import assert from "node:assert/strict";
import test from "node:test";

import {
  ANALYTICS_EVENTS,
  analyticsBlobKey,
  parseAnalyticsEvent,
  type StoredAnalyticsEvent,
} from "../netlify/functions/_shared/analytics-schema.mts";
import {
  buildAnalyticsReport,
  utcDatePrefixes,
} from "../netlify/functions/_shared/analytics-report.mts";
import {
  ANALYTICS_SESSION_SECONDS,
  createAnalyticsSession,
  isAnalyticsSessionValid,
  safeSecretEqual,
  sessionCookie,
} from "../netlify/functions/_shared/auth.mts";
import { isSameOrigin, readJsonBody } from "../netlify/functions/_shared/http.mts";

const fixedNow = new Date("2026-08-09T12:00:00.000Z");

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    event: "page_view",
    offer: "mentoria",
    variant: "h",
    segment: "ideia",
    page_id: "mentoria-h",
    page_path: "/mentoriah/",
    visitor_id: "v-11111111-1111-4111-8111-111111111111",
    session_id: "s-11111111-1111-4111-8111-111111111111",
    utm_source: "meta",
    utm_medium: "paid-social",
    utm_campaign: "{{campaign.name}} | [MENTORIA]",
    utm_content: "{{ad.name}}",
    utm_term: "interesse-escrita",
    ...overrides,
  };
}

function stored(
  event: StoredAnalyticsEvent["event"],
  visitor: string,
  offer: StoredAnalyticsEvent["offer"] = "mentoria",
  variant: StoredAnalyticsEvent["variant"] = "h",
  details: Partial<StoredAnalyticsEvent> = {},
): StoredAnalyticsEvent {
  return {
    schema_version: 1,
    event_id: crypto.randomUUID(),
    occurred_at: fixedNow.toISOString(),
    event,
    offer,
    variant,
    page_id: `${offer}-${variant}`,
    page_path: variant === "a" ? `/${offer}/` : `/${offer}${variant}/`,
    visitor_id: visitor,
    session_id: `s-${visitor}`,
    ...details,
  };
}

test("accepts the complete event contract", () => {
  for (const eventName of ANALYTICS_EVENTS) {
    const result = parseAnalyticsEvent(payload({
      event: eventName,
      qualified: eventName === "qualified_lead" ? true : undefined,
      step: "pergunta_1",
      next_step: "pergunta_2",
      depth: 50,
      trigger: "scroll_25",
      form_name: "mentoria-h",
      submission_source: "netlify",
      stage: "ideia",
      intent: "legado",
      previous_intent: "autoridade",
      previous_stage: "rascunho",
      label: "Quero continuar",
      destination: "https://pay.hotmart.com/ABC?bid=123&utm_source=email",
      referrer: "https://example.com/artigo?email=pessoa@example.com",
    }), fixedNow);
    assert.equal(result.ok, true, eventName);
  }
});

test("keeps Meta macros and strips URL query strings", () => {
  const result = parseAnalyticsEvent(payload({
    destination: "https://pay.hotmart.com/U102857700C?bid=123&utm_campaign={{campaign.name}}",
    referrer: "https://example.com/artigo?email=pessoa@example.com#trecho",
  }), fixedNow);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.event.utm_campaign, "{{campaign.name}} | [MENTORIA]");
  assert.equal(result.event.destination, "https://pay.hotmart.com/U102857700C");
  assert.equal(result.event.referrer, "https://example.com/artigo");
});

test("normalizes numeric interaction steps to strings", () => {
  const result = parseAnalyticsEvent(payload({
    event: "mechanism_step",
    step: 1,
    next_step: 2,
  }), fixedNow);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.event.step, "1");
  assert.equal(result.event.next_step, "2");
});

test("omits optional PII and unsupported optional values without dropping the event", () => {
  const result = parseAnalyticsEvent(payload({
    utm_term: "pessoa@example.com",
    label: "Ligue para 11 99999 9999",
    depth: 33,
  }), fixedNow);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.event.utm_term, undefined);
  assert.equal(result.event.label, undefined);
  assert.equal(result.event.depth, undefined);
});

test("rejects unknown fields and invalid central identifiers", () => {
  assert.equal(parseAnalyticsEvent(payload({ email: "pessoa@example.com" }), fixedNow).ok, false);
  assert.equal(parseAnalyticsEvent(payload({ page_id: "mentoria-i" }), fixedNow).ok, false);
  assert.equal(parseAnalyticsEvent(payload({ visitor_id: "short" }), fixedNow).ok, false);
  assert.equal(parseAnalyticsEvent(payload({ page_path: "/outra/" }), fixedNow).ok, false);
});

test("accepts the Memórias A home route and partitions blob keys by UTC date", () => {
  const result = parseAnalyticsEvent(payload({
    offer: "memorias",
    variant: "a",
    page_id: "memorias-a",
    page_path: "/",
  }), fixedNow);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.event.page_path, "/");
  assert.match(analyticsBlobKey(result.event), /^2026-08-09\/120000000-[0-9a-f-]+\.json$/);
});

test("counts Mentoria conversion only after a qualified_lead event", () => {
  const visitorQualified = "v-qualified";
  const visitorUnqualified = "v-unqualified";
  const events = [
    stored("page_view", visitorQualified),
    stored("mechanism_start", visitorQualified),
    stored("mechanism_step", visitorQualified, "mentoria", "h", { step: "pergunta_1" }),
    stored("mechanism_complete", visitorQualified),
    stored("form_submit_success", visitorQualified, "mentoria", "h", { qualified: true }),
    stored("application_qualification", visitorQualified, "mentoria", "h", { qualified: true }),
    stored("qualified_lead", visitorQualified, "mentoria", "h", { qualified: true }),
    stored("page_view", visitorUnqualified),
    stored("form_submit_success", visitorUnqualified, "mentoria", "h", { qualified: false }),
    stored("application_qualification", visitorUnqualified, "mentoria", "h", { qualified: false }),
  ];
  const report = buildAnalyticsReport(events, 30, fixedNow);
  const page = report.pages[0];
  assert.equal(page.visitors, 2);
  assert.equal(page.form_submits, 2);
  assert.equal(page.conversions, 1);
  assert.equal(page.qualified_leads, 1);
  assert.equal(page.rates.visitor_to_conversion, 50);
  assert.equal(report.offers.mentoria.conversions, 1);
});

test("counts checkout visitors as Memórias conversions without inflating duplicates", () => {
  const visitor = "v-memorias";
  const events = [
    stored("page_view", visitor, "memorias", "i"),
    stored("page_view", visitor, "memorias", "i"),
    stored("personalization_start", visitor, "memorias", "i"),
    stored("personalization_complete", visitor, "memorias", "i"),
    stored("checkout_click", visitor, "memorias", "i"),
    stored("checkout_click", visitor, "memorias", "i"),
  ];
  const report = buildAnalyticsReport(events, 7, fixedNow);
  const page = report.pages[0];
  assert.equal(page.visitors, 1);
  assert.equal(page.views, 2);
  assert.equal(page.checkout_clicks, 1);
  assert.equal(page.conversions, 1);
  assert.equal(page.rates.visitor_to_conversion, 100);
});

test("keeps home and /memorias/ as separate rows", () => {
  const events = [
    stored("page_view", "v-home", "memorias", "a", { page_path: "/" }),
    stored("page_view", "v-route", "memorias", "a", { page_path: "/memorias/" }),
  ];
  const report = buildAnalyticsReport(events, 7, fixedNow);
  assert.equal(report.pages.length, 2);
  assert.deepEqual(report.pages.map((page) => page.page_path).sort(), ["/", "/memorias/"]);
});

test("builds date prefixes that include both rolling-period boundary dates", () => {
  const prefixes = utcDatePrefixes(7, fixedNow);
  assert.equal(prefixes[0], "2026-08-02/");
  assert.equal(prefixes.at(-1), "2026-08-09/");
  assert.equal(prefixes.length, 8);
});

test("validates same-origin requests and enforces the JSON byte limit", async () => {
  const validRequest = new Request("https://vivianepossato.com/api/track", {
    method: "POST",
    headers: { Origin: "https://vivianepossato.com", "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(isSameOrigin(validRequest), true);
  assert.equal(isSameOrigin(new Request("https://vivianepossato.com/api/track", {
    headers: { Origin: "https://example.com" },
  })), false);
  assert.equal((await readJsonBody(validRequest, 8 * 1024)).ok, true);

  const oversized = new Request("https://vivianepossato.com/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(8200) }),
  });
  const oversizedResult = await readJsonBody(oversized, 8 * 1024);
  assert.equal(oversizedResult.ok, false);
  if (!oversizedResult.ok) assert.equal(oversizedResult.response.status, 413);
});

test("creates signed sessions and rejects tampered cookies", () => {
  Object.assign(globalThis, {
    Netlify: {
      env: {
        get: (name: string) => name === "ANALYTICS_SESSION_SECRET"
          ? "a-session-secret-with-more-than-thirty-two-characters"
          : undefined,
      },
    },
  });

  assert.equal(safeSecretEqual("same-value", "same-value"), true);
  assert.equal(safeSecretEqual("first-value", "second-value"), false);
  const token = createAnalyticsSession(fixedNow);
  const request = new Request("https://vivianepossato.com/api/analytics/report", {
    headers: { Cookie: sessionCookie(token).split(";", 1)[0] },
  });
  assert.equal(isAnalyticsSessionValid(request, fixedNow), true);
  assert.match(sessionCookie(token), /HttpOnly; Secure; SameSite=Strict/);
  const afterExpiration = new Date(fixedNow.getTime() + (ANALYTICS_SESSION_SECONDS + 1) * 1000);
  assert.equal(isAnalyticsSessionValid(request, afterExpiration), false);

  const tampered = new Request(request.url, {
    headers: { Cookie: sessionCookie(`${token}x`).split(";", 1)[0] },
  });
  assert.equal(isAnalyticsSessionValid(tampered, fixedNow), false);
});
