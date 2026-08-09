import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ANALYTICS_EVENTS,
  analyticsBlobKey,
  parseAnalyticsEvent,
  type StoredAnalyticsEvent,
} from "../netlify/functions/_shared/analytics-schema.mts";
import {
  buildAnalyticsReport,
  isStoredAnalyticsEvent,
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

function reportPage(
  report: ReturnType<typeof buildAnalyticsReport>,
  offer: StoredAnalyticsEvent["offer"],
  variant: StoredAnalyticsEvent["variant"],
  path?: string,
) {
  const page = report.pages.find((candidate) => (
    candidate.offer === offer &&
    candidate.variant === variant &&
    (!path || candidate.page_path === path)
  ));
  assert.ok(page, `${offer}-${variant}${path ? ` em ${path}` : ""}`);
  return page;
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
  const page = reportPage(report, "mentoria", "h");
  assert.equal(page.visitors, 2);
  assert.equal(page.form_submits, 2);
  assert.equal(page.conversions, 1);
  assert.equal(page.qualified_leads, 1);
  assert.equal(page.rates.visitor_to_conversion, 50);
  assert.equal(report.offers.mentoria.conversions, 1);
});

test("places Mentoria I financial qualification after the personalized result", () => {
  const events = [
    stored("page_view", "v-result-one", "mentoria", "i"),
    stored("personalization_start", "v-result-one", "mentoria", "i"),
    stored("personalization_complete", "v-result-one", "mentoria", "i"),
    stored("form_start", "v-result-one", "mentoria", "i"),
    stored("qualification_select", "v-result-one", "mentoria", "i", {
      step: "investment",
      qualified: true,
    }),
    stored("qualified_lead", "v-result-one", "mentoria", "i", { qualified: true }),
    stored("page_view", "v-result-two", "mentoria", "i"),
    stored("personalization_start", "v-result-two", "mentoria", "i"),
    stored("personalization_complete", "v-result-two", "mentoria", "i"),
  ];

  const report = buildAnalyticsReport(events, 30, fixedNow);
  const funnel = reportPage(report, "mentoria", "i").funnel;
  assert.deepEqual(funnel.map((stage) => stage.key), [
    "visitors",
    "start",
    "step_origem",
    "step_estagio",
    "step_decisao",
    "step_apoio",
    "result",
    "form_start",
    "financial_answer",
    "form_attempt",
    "form_success",
    "conversion",
  ]);
  assert.equal(funnel.find((stage) => stage.key === "result")?.visitors, 2);
  assert.equal(funnel.find((stage) => stage.key === "form_start")?.visitors, 1);
  assert.equal(funnel.find((stage) => stage.key === "form_start")?.rate_from_previous, 50);
  assert.equal(funnel.find((stage) => stage.key === "form_start")?.denominator_key, "visitors");
  assert.equal(funnel.find((stage) => stage.key === "financial_answer")?.visitors, 1);
  assert.equal(funnel.find((stage) => stage.key === "financial_answer")?.rate_from_previous, 100);
  assert.equal(funnel.find((stage) => stage.key === "financial_answer")?.denominator_key, "form_start");
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
  const page = reportPage(report, "memorias", "i");
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
  const memoriesA = report.pages.filter((page) => page.offer === "memorias" && page.variant === "a");
  assert.equal(report.pages.length, 19);
  assert.deepEqual(memoriesA.map((page) => page.page_path).sort(), ["/", "/memorias/"]);
  assert.equal(report.offers.memorias.visitors, 2);
  assert.equal(report.offer_variants.memorias.a.visitors, 1);
});

test("returns all A to I experiment pages even when the period has no events", () => {
  const report = buildAnalyticsReport([], 30, fixedNow);
  const experimentPages = report.pages.filter((page) => page.is_experiment_page);
  assert.equal(experimentPages.length, 18);
  assert.deepEqual(report.comparisons.map((comparison) => comparison.pages.length), [9, 9]);
  assert.ok(experimentPages.every((page) => page.visitors === 0 && page.has_data === false));
  assert.ok(Object.values(report.totals.rates).every((rate) => rate === null));
  assert.ok(experimentPages.every((page) => Object.values(page.rates).every((rate) => rate === null)));
  assert.deepEqual(report.filters.variants, ["a", "b", "c", "d", "e", "f", "g", "h", "i"]);
});

test("rejects corrupted stored events before adding them to the report", () => {
  const valid = stored("page_view", "v-valid", "memorias", "a");
  assert.equal(isStoredAnalyticsEvent(valid), true);
  assert.equal(isStoredAnalyticsEvent({ ...valid, event: "unknown_event" }), false);
  assert.equal(isStoredAnalyticsEvent({ ...valid, page_id: "mentoria-a" }), false);
  assert.equal(isStoredAnalyticsEvent({ ...valid, page_path: "/mentoria/" }), false);
});

test("loads the shared tracking contract on every A to I route", () => {
  const variants = ["a", "b", "c", "d", "e", "f", "g", "h", "i"] as const;
  for (const offer of ["memorias", "mentoria"] as const) {
    for (const variant of variants) {
      const directory = variant === "a" ? offer : `${offer}${variant}`;
      const html = readFileSync(new URL(`../${directory}/index.html`, import.meta.url), "utf8");
      assert.match(html, new RegExp(`<body[^>]*data-offer=["']${offer}["'][^>]*data-variant=["']${variant}["']`), `${offer}-${variant}`);
      assert.match(html, /<script src=["']\/assets\/site\.js["'] defer><\/script>/, `${offer}-${variant}`);
    }
  }
});

test("uses page-specific denominators for optional and required experiences", () => {
  const events = [
    stored("page_view", "v-mentor-e", "mentoria", "e"),
    stored("form_start", "v-mentor-e", "mentoria", "e"),
    stored("page_view", "v-memory-h", "memorias", "h"),
    stored("quiz_start", "v-memory-h", "memorias", "h"),
    stored("quiz_step", "v-memory-h", "memorias", "h", { step: "1" }),
    stored("quiz_step", "v-memory-h", "memorias", "h", { step: "2" }),
    stored("quiz_step", "v-memory-h", "memorias", "h", { step: "3" }),
    stored("quiz_complete", "v-memory-h", "memorias", "h"),
    stored("checkout_click", "v-memory-h", "memorias", "h"),
    stored("page_view", "v-memory-i", "memorias", "i"),
    stored("checkout_click", "v-memory-i", "memorias", "i"),
  ];
  const report = buildAnalyticsReport(events, 30, fixedNow);
  const mentorE = reportPage(report, "mentoria", "e");
  assert.equal(mentorE.funnel.find((stage) => stage.key === "form_start")?.denominator_key, "visitors");
  assert.equal(mentorE.funnel.find((stage) => stage.key === "form_start")?.rate_from_previous, 100);

  const memoryH = reportPage(report, "memorias", "h");
  const comparisonDecision = memoryH.comparison_funnel.find((stage) => stage.key === "decision");
  const comparisonConversion = memoryH.comparison_funnel.find((stage) => stage.key === "conversion");
  assert.equal(comparisonDecision?.applicable, false);
  assert.equal(comparisonConversion?.label, "Checkout aberto");
  assert.equal(comparisonConversion?.denominator_key, "experience_complete");
  assert.equal(comparisonConversion?.rate_from_previous, 100);
  assert.equal(memoryH.funnel.find((stage) => stage.key === "conversion")?.denominator_key, "result");

  const memoryI = reportPage(report, "memorias", "i");
  assert.equal(memoryI.comparison_funnel.find((stage) => stage.key === "conversion")?.denominator_key, "visitors");
  assert.equal(memoryI.funnel.find((stage) => stage.key === "conversion")?.denominator_key, "visitors");
});

test("treats I personalization as optional because header links bypass it", () => {
  const memoriesI = readFileSync(new URL("../memoriasi/index.html", import.meta.url), "utf8");
  const mentoringI = readFileSync(new URL("../mentoriai/index.html", import.meta.url), "utf8");
  assert.match(memoriesI, /class="i-header__link" href="#oferta"/);
  assert.match(mentoringI, /class="i-header__link" href="#aplicacao"/);

  const report = buildAnalyticsReport([], 30, fixedNow);
  assert.equal(reportPage(report, "memorias", "i").funnel.at(-1)?.denominator_key, "visitors");
  assert.equal(reportPage(report, "mentoria", "i").funnel.find((stage) => stage.key === "form_start")?.denominator_key, "visitors");
});

test("treats the Memories D quiz as optional because its header opens checkout", () => {
  const memoriesD = readFileSync(new URL("../memoriasd/index.html", import.meta.url), "utf8");
  assert.match(memoriesD, /<a href="https:\/\/pay\.hotmart\.com\/[^"?]+\?[^\"]+"[^>]*>Conhecer o curso<\/a>/);

  const report = buildAnalyticsReport([], 30, fixedNow);
  assert.equal(reportPage(report, "memorias", "d").funnel.at(-1)?.denominator_key, "visitors");
  assert.equal(reportPage(report, "mentoria", "d").funnel.find((stage) => stage.key === "form_attempt")?.denominator_key, "result");
});

test("keeps universal A to I stages aligned across offers", () => {
  const report = buildAnalyticsReport([], 7, fixedNow);
  const expected = ["visitors", "engaged", "experience_start", "experience_complete", "decision", "conversion"];
  report.comparisons.forEach((comparison) => {
    comparison.pages.forEach((page) => {
      assert.deepEqual(page.comparison_funnel.map((stage) => stage.key), expected);
    });
  });
});

test("renders A to I controls and keeps the selected rate tied to each bar", () => {
  const html = readFileSync(new URL("../analise/index.html", import.meta.url), "utf8");
  const client = readFileSync(new URL("../assets/analytics-dashboard.js", import.meta.url), "utf8");
  const css = readFileSync(new URL("../assets/analytics-dashboard.css", import.meta.url), "utf8");
  assert.match(html, /id="variantSelect"/);
  assert.match(html, /id="rateBasisSelect"/);
  assert.match(html, /id="readingGrid"/);
  assert.doesNotMatch(html, /Comparativo H e I|Experimentos H e I/);
  assert.match(client, /comparison\.offer === 'mentoria' \|\| stage\.key !== 'decision'/);
  assert.match(client, /const barRate = stage\.denominator_key \? selectedRate\(stage\) : stage\.rate_from_visitors/);
  assert.match(client, /variant !== 'all' && !page\.is_experiment_page/);
  assert.match(client, /cell\.colSpan = 8/);
  assert.match(css, /@media \(max-width: 480px\)[\s\S]*?\.funnel-stage-line[\s\S]*?flex-direction: column/);
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
