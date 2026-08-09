import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const siteSource = readFileSync(new URL("../assets/site.js", import.meta.url), "utf8");
const variantHSource = readFileSync(new URL("../assets/variant-h.js", import.meta.url), "utf8");
const variantHCss = readFileSync(new URL("../assets/variant-h.css", import.meta.url), "utf8");
const memoriesHSource = readFileSync(new URL("../memoriash/index.html", import.meta.url), "utf8");
const mentoringHSource = readFileSync(new URL("../mentoriah/index.html", import.meta.url), "utf8");

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
} = {}) {
  let clock = 1_000_000;
  const timers: Array<() => void> = [];
  const windowListeners = new Map<string, EventHandler[]>();
  const formListeners = new Map<string, EventHandler[]>();
  const sessionStorage = createStorage(options.session);
  const localStorage = createStorage();
  const parsedUrl = new URL(options.url || "http://localhost/memoriash/");

  const submitButton = {
    disabled: false,
    textContent: "Enviar meu diagnóstico",
    removeAttribute(_name: string): void {},
  };
  const status = {
    textContent: "Os dados serão usados para responder sobre a mentoria.",
    classList: createClassList(),
  };
  const form = {
    id: "lead-form",
    dataset: {} as Record<string, string>,
    querySelector(selector: string): unknown {
      if (selector === "[data-form-status]") return status;
      if (selector === 'button[type="submit"], input[type="submit"]') return submitButton;
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
      return name === "name" ? "mentoria-h" : null;
    },
    checkValidity(): boolean {
      return true;
    },
    reportValidity(): void {},
  };

  const body = {
    dataset: { offer: "memorias", variant: "h" } as Record<string, string>,
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

    get(_name: string): null {
      return null;
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
    /href="#mentoria-h-copy-personalizada" data-h-personalized-link>Ler meu mapa personalizado/,
  );
  assert.match(
    mentoringHSource,
    /id="mentoria-h-copy-personalizada"[^>]+data-h-personalized-copy/,
  );
  assert.doesNotMatch(
    mentoringHSource.match(/<div class="h-unqualified" data-h-unqualified hidden>[\s\S]*?<\/div>/)?.[0] || "",
    /pay\.hotmart\.com/,
  );
  assert.match(
    mentoringHSource,
    /data-h-unqualified-offer hidden>[\s\S]*?pay\.hotmart\.com[\s\S]*?alternativa-apos-copy/,
  );
});

test("scrolls to the personalized H copy without creating a checkout event", () => {
  assert.match(variantHSource, /scrollToElement\(personalizedCopy\)/);
  assert.match(variantHSource, /focusHeading\(personalizedCopy\)/);
  assert.match(variantHSource, /personalizedTitle\.textContent/);
  assert.match(variantHSource, /personalizedText\.textContent/);
  assert.match(variantHCss, /\.h-offer\s*{[^}]*scroll-margin-top: 96px;/s);
});

test("disables the Aust form button after success and restores it on reset", () => {
  const harness = createSiteHarness({
    withForm: true,
    session: { viviane_pending_application: "pending" },
  });

  harness.dispatchForm("aust:form:submitted");
  assert.equal(harness.submitButton.disabled, true);
  assert.equal(harness.submitButton.textContent, "Diagnóstico enviado");

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
