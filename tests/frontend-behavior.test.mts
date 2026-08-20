import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const siteSource = readFileSync(new URL("../assets/site.js", import.meta.url), "utf8");
const variantHSource = readFileSync(new URL("../assets/variant-h.js", import.meta.url), "utf8");
const variantISource = readFileSync(new URL("../assets/variant-i.js", import.meta.url), "utf8");
const variantHCss = readFileSync(new URL("../assets/variant-h.css", import.meta.url), "utf8");
const memoriesHSource = readFileSync(new URL("../memoriash/index.html", import.meta.url), "utf8");
const mentoringHSource = readFileSync(new URL("../mentoriah/index.html", import.meta.url), "utf8");
const memoriesDSource = readFileSync(new URL("../memoriasd/index.html", import.meta.url), "utf8");
const mentoringDSource = readFileSync(new URL("../mentoriad/index.html", import.meta.url), "utf8");
const memoriesJSource = readFileSync(new URL("../memoriasj/index.html", import.meta.url), "utf8");
const mentoringJSource = readFileSync(new URL("../mentoriaj/index.html", import.meta.url), "utf8");
const variantJCss = readFileSync(new URL("../assets/variant-j.css", import.meta.url), "utf8");
const mentoringASource = readFileSync(new URL("../mentoria/index.html", import.meta.url), "utf8");

type EventDetail = Record<string, unknown>;
type MockEvent = { type: string; detail?: EventDetail };
type EventHandler = (event: MockEvent) => void;

function createStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, String(value));
    },
    removeItem(key: string): void {
      values.delete(key);
    },
  };
}

function createClassList() {
  const values = new Set<string>();
  return {
    add(value: string): void {
      values.add(value);
    },
    remove(value: string): void {
      values.delete(value);
    },
    contains(value: string): boolean {
      return values.has(value);
    },
  };
}

function createSiteHarness(options: {
  url?: string;
  session?: Record<string, string>;
  withForm?: boolean;
  investmentQualified?: boolean;
} = {}) {
  let clock = 1_000_000;
  const timers: Array<() => void> = [];
  const windowListeners = new Map<string, EventHandler[]>();
  const formListeners = new Map<string, EventHandler[]>();
  const sessionStorage = createStorage(options.session);
  const localStorage = createStorage();
  const parsedUrl = new URL(options.url || "http://localhost/memoriash/");
  let assignedLocation = "";

  const submitButton = {
    disabled: false,
    textContent: "Enviar meu diagnóstico",
    removeAttribute(_name: string): void {},
  };
  const status = {
    textContent: "Os dados serão usados para responder sobre a mentoria.",
    classList: createClassList(),
  };
  const investmentControl = options.investmentQualified === undefined ? null : {
    dataset: { qualified: String(options.investmentQualified) },
    value: options.investmentQualified
      ? "Tenho disponibilidade para considerar o investimento a partir de R$ 9.997"
      : "Esse investimento não cabe no meu momento",
  };
  const form = {
    id: "lead-form",
    dataset: {} as Record<string, string>,
    querySelector(selector: string): unknown {
      if (selector === "[data-form-status]") return status;
      if (selector === 'button[type="submit"], input[type="submit"]') return submitButton;
      if (selector === '[name="investimento"]:checked' || selector === '[name="investimento"]') return investmentControl;
      return null;
    },
    querySelectorAll(_selector: string): unknown[] {
      return [];
    },
    addEventListener(type: string, handler: EventHandler): void {
      const handlers = formListeners.get(type) || [];
      handlers.push(handler);
      formListeners.set(type, handlers);
    },
    getAttribute(name: string): string | null {
      if (name === "name") return "mentoria-h";
      if (name === "action") return "/obrigada/";
      return null;
    },
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): void {},
  };

  const body = {
    dataset: { offer: options.withForm ? "mentoria" : "memorias", variant: "h" } as Record<string, string>,
  };
  const documentMock = {
    body,
    documentElement: { scrollHeight: 1100 },
    head: { appendChild(_element: unknown): void {} },
    referrer: "",
    createElement(_name: string): Record<string, unknown> {
      return {};
    },
    getElementById(_id: string): null {
      return null;
    },
    querySelectorAll(selector: string): unknown[] {
      if (selector === "form#lead-form" && options.withForm) return [form];
      return [];
    },
  };

  class TestCustomEvent {
    type: string;
    detail?: EventDetail;

    constructor(type: string, init?: { detail?: EventDetail }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  class TestFormData {
    constructor(_form?: unknown) {}

    get(name: string): string | null {
      return name === "investimento" && investmentControl ? investmentControl.value : null;
    }
  }

  const windowMock = {
    crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
    localStorage,
    sessionStorage,
    location: {
      href: parsedUrl.href,
      hostname: parsedUrl.hostname,
      pathname: parsedUrl.pathname,
      search: parsedUrl.search,
      assign(value: string): void {
        assignedLocation = value;
      },
    },
    innerHeight: 100,
    scrollY: 0,
    fetch: async () => ({ ok: true }),
    setTimeout(callback: () => void): number {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout(_id: number): void {},
    requestAnimationFrame(callback: () => void): number {
      callback();
      return 0;
    },
    addEventListener(type: string, handler: EventHandler): void {
      const handlers = windowListeners.get(type) || [];
      handlers.push(handler);
      windowListeners.set(type, handlers);
    },
    dispatchEvent(event: MockEvent): boolean {
      (windowListeners.get(event.type) || []).forEach((handler) => handler(event));
      return true;
    },
  } as Record<string, unknown> & {
    dataLayer?: Array<Record<string, unknown>>;
    scrollY: number;
  };

  vm.runInNewContext(siteSource, {
    window: windowMock,
    document: documentMock,
    URL,
    URLSearchParams,
    CustomEvent: TestCustomEvent,
    FormData: TestFormData,
    Date: { now: () => clock },
  });

  return {
    body,
    form,
    sessionStorage,
    status,
    submitButton,
    dataLayer: windowMock.dataLayer || [],
    get metaCalls(): unknown[][] {
      const fbq = windowMock.fbq as { queue?: ArrayLike<unknown[]> } | undefined;
      return fbq && fbq.queue ? Array.from(fbq.queue, (entry) => Array.from(entry)) : [];
    },
    get assignedLocation(): string {
      return assignedLocation;
    },
    dispatchForm(type: string, detail?: EventDetail): void {
      (formListeners.get(type) || []).forEach((handler) => handler({ type, detail }));
    },
    dispatchWindow(type: string, detail?: EventDetail): void {
      const dispatchEvent = windowMock.dispatchEvent as (event: MockEvent) => boolean;
      dispatchEvent({ type, detail });
    },
    advance(milliseconds: number): void {
      clock += milliseconds;
    },
    flushTimers(): void {
      timers.splice(0).forEach((callback) => callback());
    },
    setScrollY(value: number): void {
      windowMock.scrollY = value;
    },
  };
}

test("replaces a stored campaign when the URL contains a partial new campaign", () => {
  const harness = createSiteHarness({
    url: "http://localhost/memoriash/?utm_source=instagram&utm_campaign=agosto",
    session: {
      viviane_utm_source: "facebook",
      viviane_utm_medium: "paid-social",
      viviane_utm_campaign: "julho",
      viviane_utm_content: "criativo-antigo",
      viviane_utm_term: "interesse-antigo",
    },
  });

  assert.equal(harness.sessionStorage.getItem("viviane_utm_source"), "instagram");
  assert.equal(harness.sessionStorage.getItem("viviane_utm_campaign"), "agosto");
  assert.equal(harness.sessionStorage.getItem("viviane_utm_medium"), null);
  assert.equal(harness.sessionStorage.getItem("viviane_utm_content"), null);
  assert.equal(harness.sessionStorage.getItem("viviane_utm_term"), null);

  const pageView = harness.dataLayer.find((entry) => entry.event === "page_view");
  assert.equal(pageView?.utm_source, "instagram");
  assert.equal(pageView?.utm_campaign, "agosto");
  assert.equal(pageView?.utm_medium, "");
  assert.equal(pageView?.utm_content, "memorias-h");
});

test("keeps the redesigned Mentoria A form connected to Aust CRM", () => {
  assert.match(mentoringASource, /<form id="lead-form" name="mentoria-a" method="POST" action="\/obrigada\/" data-netlify="true" netlify-honeypot="bot-field"/);
  assert.match(mentoringASource, /class="diagnostic-form" aria-labelledby="diagnostico-titulo"/);
  assert.match(
    mentoringASource,
    /<script async src="https:\/\/app\.austhq\.com\/forms\.js" data-aust-form="88cfead0-7a9f-4e80-9490-7631ed1edc06" data-aust-form-id="lead-form"><\/script>/,
  );

  for (const fieldName of [
    "form-name",
    "pagina",
    "rota",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "name",
    "email",
    "whatsapp_with_ddd",
    "tema",
    "estagio",
    "trava",
  ]) {
    assert.match(mentoringASource, new RegExp(`name="${fieldName}"`), `missing CRM field ${fieldName}`);
  }
});

test("keeps example text away from the Mentoria A field borders", () => {
  assert.match(
    mentoringASource,
    /#diagnostico input:not\(\[type="hidden"\]\):not\(\[type="radio"\]\) \{\s*padding:\.9rem 1\.15rem;/,
  );
  assert.match(
    mentoringASource,
    /#diagnostico select \{\s*padding:\.9rem 2\.8rem \.9rem 1\.15rem;/,
  );
});

test("keeps Mentoria J connected to Aust CRM and marks qualification explicitly", () => {
  assert.match(mentoringJSource, /name="mentoria-j"/);
  assert.match(mentoringJSource, /data-aust-form="88cfead0-7a9f-4e80-9490-7631ed1edc06"/);
  assert.equal((mentoringJSource.match(/name="disponibilidade"[^>]*data-qualified="true"/g) || []).length, 3);
  assert.equal((mentoringJSource.match(/name="disponibilidade"[^>]*data-qualified="false"/g) || []).length, 1);
  assert.match(mentoringJSource, /name="name"/);
  assert.match(mentoringJSource, /name="email"/);
  assert.match(mentoringJSource, /name="whatsapp_with_ddd"/);
  assert.match(mentoringJSource, /name="tema"/);
  assert.match(mentoringJSource, /name="estagio"/);
  assert.match(mentoringJSource, /name="trava"/);
});

test("removes investment qualification from Mentoria A and preserves the archived Mentoria J choices", () => {
  assert.doesNotMatch(mentoringASource, /name="disponibilidade"/);
  assert.match(mentoringJSource, /value="Até R\$ 5\.000" data-qualified="true"/);
  assert.match(mentoringJSource, /value="De R\$ 5\.001 a R\$ 9\.996" data-qualified="true"/);
  assert.match(mentoringJSource, /value="A partir de R\$ 9\.997" data-qualified="true"/);
  assert.match(mentoringJSource, /value="Ainda não pretendo investir" data-qualified="false"/);
});

test("keeps Mentoria J placeholders inset from field borders", () => {
  assert.match(variantJCss, /\.j-field input,[\s\S]*?padding:\s*\.88rem 1rem;/);
  assert.match(mentoringJSource, /placeholder="Digite seu nome"/);
  assert.match(mentoringJSource, /placeholder="Ex\.: recorte, estrutura ou revisão"/);
});

test("keeps Memories J on the existing Hotmart checkout", () => {
  const checkoutLinks = memoriesJSource.match(/https:\/\/pay\.hotmart\.com\/U102857700C\?bid=1766501787612/g) || [];
  assert.equal(checkoutLinks.length, 3);
});

test("retains the stored campaign when the URL has no UTM parameter", () => {
  const harness = createSiteHarness({
    url: "http://localhost/memoriash/?fbclid=123",
    session: {
      viviane_utm_source: "facebook",
      viviane_utm_medium: "paid-social",
      viviane_utm_campaign: "agosto",
      viviane_utm_content: "criativo-3",
    },
  });
  const pageView = harness.dataLayer.find((entry) => entry.event === "page_view");

  assert.equal(pageView?.utm_source, "facebook");
  assert.equal(pageView?.utm_medium, "paid-social");
  assert.equal(pageView?.utm_campaign, "agosto");
  assert.equal(pageView?.utm_content, "criativo-3");
});

test("routes result CTAs through the personalized H copy before checkout", () => {
  assert.match(
    memoriesHSource,
    /href="#memorias-h-copy-personalizada" data-h-personalized-link>Ler minha página personalizada/,
  );
  assert.match(
    memoriesHSource,
    /id="memorias-h-copy-personalizada"[^>]+data-h-personalized-copy/,
  );
  assert.doesNotMatch(
    memoriesHSource.match(/<section class="h-result"[\s\S]*?<\/section>/)?.[0] || "",
    /pay\.hotmart\.com/,
  );

  assert.match(
    mentoringHSource,
    /href="#mentoria-h-copy-personalizada" data-h-personalized-link>Ler como a mentoria seria aplicada ao meu livro/,
  );
  assert.match(
    mentoringHSource,
    /id="mentoria-h-copy-personalizada"[^>]+data-h-personalized-copy/,
  );
  assert.doesNotMatch(mentoringHSource, /pay\.hotmart\.com|Escrita de Memórias|data-h-unqualified-offer/);
  assert.ok(
    mentoringHSource.indexOf('id="mentoria-h-copy-personalizada"') < mentoringHSource.indexOf('id="lead-form"'),
    "the personalized mentoring copy must come before the application form",
  );
});

test("keeps mentoring H inside the mentoring offer and removes diagnosis restarts", () => {
  assert.doesNotMatch(mentoringHSource, /data-h-restart|Refazer o diagnóstico|Responder novamente/);
  assert.doesNotMatch(variantHSource, /curso Escrita de Memórias pode ser uma forma/);
  assert.match(mentoringHSource, /data-h-qualified hidden/);
  assert.match(mentoringHSource, /data-h-unqualified hidden/);
  assert.match(variantHSource, /qualifiedMentorSection\.hidden = !qualified/);
  assert.match(variantHSource, /unqualifiedMentorSection\.hidden = qualified/);
});

test("explains and personalizes the complete Memories H course after the quiz", () => {
  for (const movement of ["A Linha do Tempo", "O Inventário Afetivo", "Os sabores da Memória", "A Escrita dos Rituais"]) {
    assert.match(memoriesHSource, new RegExp(movement));
  }
  for (const selector of [
    "data-h-memory-subject-title",
    "data-h-memory-signal-title",
    "data-h-memory-block-title",
    "data-h-memory-topic-examples",
    "data-h-memory-final-title",
  ]) {
    assert.match(memoriesHSource, new RegExp(selector));
    assert.match(variantHSource, new RegExp(selector));
  }
  assert.match(memoriesHSource, /aulas gravadas/);
  assert.match(memoriesHSource, /acesso é vitalício/);
  assert.match(memoriesHSource, /Nunca escrevi memórias/);
  assert.match(memoriesHSource, /Preciso mostrar os meus textos/);
});

test("defines complete personalized copy for every H answer", () => {
  const literal = variantHSource.match(/const content = (\{[\s\S]*?\n  \});\n\n  function emit/)?.[1];
  assert.ok(literal, "the H content object must remain readable by the regression test");
  const content = vm.runInNewContext(`(${literal})`) as {
    memorias: {
      subjects: Record<string, Record<string, string>>;
      signals: Record<string, Record<string, string>>;
      blocks: Record<string, Record<string, string>>;
    };
    mentoria: {
      stages: Record<string, Record<string, string>>;
      readers: Record<string, Record<string, string>>;
      obstacles: Record<string, Record<string, string>>;
      finance: Record<string, Record<string, string | boolean>>;
    };
  };

  for (const subject of Object.values(content.memorias.subjects)) {
    for (const field of ["courseTitle", "courseText", "reasonText", "examples", "finalTitle"]) assert.ok(subject[field]);
  }
  for (const signal of Object.values(content.memorias.signals)) {
    for (const field of ["courseTitle", "courseText", "moduleLabel"]) assert.ok(signal[field]);
    assert.equal(typeof signal.module, "string");
  }
  for (const block of Object.values(content.memorias.blocks)) {
    for (const field of ["courseTitle", "courseText"]) assert.ok(block[field]);
  }
  for (const stage of Object.values(content.mentoria.stages)) {
    for (const field of ["mentorshipTitle", "mentorshipText", "cardTitle", "deliverable"]) assert.ok(stage[field]);
  }
  for (const reader of Object.values(content.mentoria.readers)) {
    for (const field of ["mentorshipTitle", "mentorshipText"]) assert.ok(reader[field]);
  }
  for (const obstacle of Object.values(content.mentoria.obstacles)) {
    for (const field of ["resultTitle", "mentorshipTitle", "mentorshipText"]) assert.ok(obstacle[field]);
  }
  for (const finance of Object.values(content.mentoria.finance)) {
    for (const field of ["closingTitle", "closingText"]) assert.ok(finance[field]);
    assert.doesNotMatch(String(finance.reply), /Memórias|Hotmart/);
  }
});

test("keeps H fragment links and accessible labels connected", () => {
  for (const source of [memoriesHSource, mentoringHSource]) {
    const ids = Array.from(source.matchAll(/\sid="([^"]+)"/g), (match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, "page IDs must be unique");

    for (const fragment of Array.from(source.matchAll(/href="#([^"]+)"/g), (match) => match[1])) {
      assert.ok(ids.includes(fragment), `missing fragment target #${fragment}`);
    }
    for (const referenceList of Array.from(source.matchAll(/aria-labelledby="([^"]+)"/g), (match) => match[1])) {
      for (const reference of referenceList.split(/\s+/)) {
        assert.ok(ids.includes(reference), `missing aria-labelledby target #${reference}`);
      }
    }
  }
});

test("scrolls to the personalized H copy without creating a checkout event", () => {
  assert.match(variantHSource, /scrollToElement\(personalizedCopy\)/);
  assert.match(variantHSource, /focusHeading\(personalizedCopy\)/);
  assert.match(variantHSource, /personalizedTitle\.textContent/);
  assert.match(variantHSource, /personalizedText\.textContent/);
  assert.match(variantHCss, /\.h-offer\s*{[^}]*scroll-margin-top: 96px;/s);
});

test("redirects after Aust success and restores the form state on reset", () => {
  const harness = createSiteHarness({
    withForm: true,
    session: { viviane_pending_application: "pending" },
  });

  harness.dispatchForm("aust:form:submitted");
  assert.equal(harness.submitButton.disabled, true);
  assert.equal(harness.submitButton.textContent, "Diagnóstico enviado");
  assert.equal(harness.assignedLocation, "/obrigada/");

  harness.form.dataset.qualifiedConversionTracked = "true";
  harness.dispatchForm("reset");
  harness.flushTimers();

  assert.equal(harness.submitButton.disabled, false);
  assert.equal(harness.submitButton.textContent, "Enviar meu diagnóstico");
  assert.equal(harness.status.textContent, "Os dados serão usados para responder sobre a mentoria.");
  assert.equal(harness.form.dataset.lastTrackedSuccess, undefined);
  assert.equal(harness.form.dataset.qualifiedConversionTracked, undefined);
  assert.equal(harness.sessionStorage.getItem("viviane_pending_application"), null);
});

test("sends Meta Lead after every confirmed application", () => {
  const harness = createSiteHarness({
    url: "https://vivianepossato.com/mentoriah/",
    withForm: true,
    investmentQualified: false,
  });

  harness.dispatchForm("aust:form:submitted");

  assert.equal(harness.assignedLocation, "/obrigada/");
  assert.equal(harness.dataLayer.some((entry) => entry.event === "form_submit_success"), true);
  assert.equal(harness.dataLayer.some((entry) => entry.event === "qualified_lead"), true);
  assert.equal(harness.metaCalls.some((call) => call[0] === "track" && call[1] === "Lead"), true);
});

test("deduplicates Meta Lead after a confirmed application", () => {
  const harness = createSiteHarness({
    url: "https://vivianepossato.com/mentoriah/",
    withForm: true,
    investmentQualified: true,
  });

  harness.dispatchForm("aust:form:submitted");
  harness.dispatchForm("aust:form:submitted");

  assert.equal(harness.dataLayer.filter((entry) => entry.event === "qualified_lead").length, 1);
  assert.equal(harness.metaCalls.filter((call) => call[0] === "track" && call[1] === "Lead").length, 1);
});

test("ignores scroll depth during the H programmatic scroll window", () => {
  const harness = createSiteHarness();
  harness.setScrollY(750);
  harness.dispatchWindow("viviane:programmatic-scroll", { duration: 1000 });
  harness.dispatchWindow("scroll");

  assert.equal(harness.dataLayer.some((entry) => entry.event === "scroll_depth"), false);

  harness.advance(1001);
  harness.dispatchWindow("scroll");
  assert.deepEqual(
    Array.from(
      harness.dataLayer.filter((entry) => entry.event === "scroll_depth"),
      (entry) => entry.depth,
    ),
    [25, 50, 75],
  );
});

test("signals the analytics guard before H moves the viewport", () => {
  const signalIndex = variantHSource.indexOf("'viviane:programmatic-scroll'");
  const scrollIndex = variantHSource.indexOf("element.scrollIntoView", signalIndex);

  assert.notEqual(signalIndex, -1);
  assert.ok(scrollIndex > signalIndex);
});

test("automatically advances every radio question in the D quizzes", () => {
  assert.match(
    memoriesDSource,
    /automaticNextScreen = \{ q1:'q2', q2:'q3', q3:'bridge', q4:'q5', q5:'q6', q6:'result' \}/,
  );
  assert.match(
    mentoringDSource,
    /automaticNextScreen = \{ q1:'q2', q3:'bridge', q4:'q5', q5:'q6', q6:'result' \}/,
  );

  for (const source of [memoriesDSource, mentoringDSource]) {
    assert.match(source, /form\.addEventListener\('change',[\s\S]*?queueAutomaticAdvance\(current, nextScreen\)/);
    assert.match(source, /function advanceFromScreen\(screen, nextScreen\)/);
    assert.match(source, /heading\.focus\(\{ preventScroll: true \}\)/);
  }
});

test("cancels the queued D advance when the existing continue action runs first", () => {
  for (const source of [memoriesDSource, mentoringDSource]) {
    assert.match(
      source,
      /function showScreen\(name\) \{\s*if \(automaticAdvanceTimer\) \{\s*window\.clearTimeout\(automaticAdvanceTimer\);/,
    );
    assert.equal(source.match(/vivianeTrack\('quiz_step'/g)?.length, 1);
    assert.equal(source.match(/vivianeTrack\('quiz_complete'/g)?.length, 1);
    assert.match(source, /advanceFromScreen\(current, button\.dataset\.next\)/);
    assert.match(source, /advanceFromScreen\(current, 'result'\)/);
  }
});

test("automatically scrolls H and I choices and moves focus to the next prompt", () => {
  assert.match(variantHSource, /queueAnswerNavigation\(nextStep\)/);
  assert.match(variantHSource, /queueAnswerNavigation\(result\)/);
  assert.match(
    variantHSource,
    /function queueAnswerNavigation\(target\)[\s\S]*?scrollToElement\(target\);[\s\S]*?focusHeading\(target\)/,
  );

  assert.match(
    variantISource,
    /const nextTarget = stepIndex === steps\.length - 1[\s\S]*?queueChoiceNavigation\(nextTarget\)/,
  );
  assert.match(variantISource, /focusTarget\.focus\(\{ preventScroll: true \}\)/);
});

test("cancels stale focus timers and gives keyboard arrows time to move within a radio group", () => {
  assert.match(variantHSource, /function cancelPendingAnswerNavigation\(\)[\s\S]*?window\.clearTimeout\(headingFocusTimer\)/);
  assert.match(variantHSource, /usedArrowKey[\s\S]*?return 1000/);
  assert.match(variantISource, /function cancelPendingChoiceNavigation\(\)[\s\S]*?window\.clearTimeout\(headingFocusTimer\)/);
  assert.match(variantISource, /usedArrowKey[\s\S]*?return 1000/);

  for (const source of [memoriesDSource, mentoringDSource]) {
    assert.match(source, /if \(headingFocusTimer\) \{\s*window\.clearTimeout\(headingFocusTimer\)/);
    assert.match(source, /usedArrowKey \? 1000 : \(reducedMotion \? 0 : 220\)/);
  }
});

test("guards scroll-depth tracking before every automatic quiz scroll", () => {
  for (const source of [memoriesDSource, mentoringDSource, variantHSource, variantISource]) {
    const signalIndex = source.indexOf("viviane:programmatic-scroll");
    const scrollIntoViewIndex = source.indexOf("scrollIntoView", signalIndex);
    const scrollToIndex = source.indexOf("scrollTo", signalIndex);
    const viewportMoveIndex = scrollIntoViewIndex === -1 ? scrollToIndex : scrollIntoViewIndex;

    assert.notEqual(signalIndex, -1);
    assert.ok(viewportMoveIndex > signalIndex);
  }
});

test("keeps conversion calls outside the quiz auto-scroll implementations", () => {
  for (const source of [memoriesDSource, mentoringDSource, variantHSource, variantISource]) {
    assert.doesNotMatch(source, /fbq\(['"]track['"],\s*['"](?:Lead|InitiateCheckout)['"]/);
  }
});

test("keeps the Mentoria D completion payload inside the analytics contract", () => {
  assert.match(
    mentoringDSource,
    /vivianeTrack\('quiz_complete', \{ stage: valueOf\('q1'\) \}\)/,
  );
  assert.doesNotMatch(mentoringDSource, /quiz_complete[^\n]*investment/);
});

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((start) => Number.parseInt(value.slice(start, start + 2), 16)) as [number, number, number];
}

function blend(foreground: [number, number, number], background: [number, number, number], alpha: number): [number, number, number] {
  return foreground.map((value, index) => Math.round(value * alpha + background[index] * (1 - alpha))) as [number, number, number];
}

function luminance(rgb: [number, number, number]): number {
  const channels = rgb.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(left: [number, number, number], right: [number, number, number]): number {
  const leftLuminance = luminance(left);
  const rightLuminance = luminance(right);
  return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
}

test("keeps the H focus indicator and placeholders above WCAG contrast thresholds", () => {
  assert.match(variantHCss, /\.h-option:has\(input:focus-visible\)\s*{[^}]*outline:\s*3px solid var\(--h-accent\)/s);
  const placeholderAlpha = Number(variantHCss.match(/\.h-field input::placeholder,[^}]*rgba\(255, 255, 255, ([0-9.]+)\)/s)?.[1]);
  assert.ok(Number.isFinite(placeholderAlpha));

  const white: [number, number, number] = [255, 255, 255];
  const palettes = [
    { paper: "#fdfcf8", ink: "#1f1f1f", accent: "#805858" },
    { paper: "#fafaf9", ink: "#1a1a1a", accent: "#a92f2f" },
  ];

  palettes.forEach((palette) => {
    assert.ok(contrast(hexToRgb(palette.accent), hexToRgb(palette.paper)) >= 3);
    const fieldBackground = blend(white, hexToRgb(palette.ink), 0.08);
    const placeholder = blend(white, fieldBackground, placeholderAlpha);
    assert.ok(contrast(placeholder, fieldBackground) >= 4.5);
  });
});
