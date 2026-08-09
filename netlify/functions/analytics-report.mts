import { getStore, type Store } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

import { isAnalyticsSessionValid } from "./_shared/auth.mts";
import {
  buildAnalyticsReport,
  isStoredAnalyticsEvent,
  utcDatePrefixes,
} from "./_shared/analytics-report.mts";
import type { StoredAnalyticsEvent } from "./_shared/analytics-schema.mts";
import { jsonResponse, methodNotAllowed } from "./_shared/http.mts";

const PERIODS = new Set([7, 30, 90]);

async function listKeys(store: Store, prefixes: string[]): Promise<string[]> {
  const keys: string[] = [];
  const batchSize = 8;

  for (let index = 0; index < prefixes.length; index += batchSize) {
    const batch = prefixes.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async (prefix) => {
      const prefixKeys: string[] = [];
      for await (const page of store.list({ prefix, paginate: true })) {
        prefixKeys.push(...page.blobs.map((blob) => blob.key));
      }
      return prefixKeys;
    }));
    keys.push(...results.flat());
  }

  return keys;
}

async function readEvents(
  store: Store,
  keys: string[],
): Promise<{ events: StoredAnalyticsEvent[]; ignored: number }> {
  const events: StoredAnalyticsEvent[] = [];
  let ignored = 0;
  const batchSize = 24;

  for (let index = 0; index < keys.length; index += batchSize) {
    const batch = keys.slice(index, index + batchSize);
    const values = await Promise.all(batch.map(async (key) => {
      try {
        return await store.get(key, { type: "json" });
      } catch {
        return null;
      }
    }));

    for (const value of values) {
      if (isStoredAnalyticsEvent(value)) events.push(value);
      else ignored += 1;
    }
  }

  return { events, ignored };
}

export default async function analyticsReport(request: Request): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed("GET");

  try {
    if (!isAnalyticsSessionValid(request)) {
      return jsonResponse({ error: "Sessão expirada." }, 401);
    }
  } catch (error) {
    console.error("analytics_auth_configuration_error", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonResponse({ error: "O acesso ao painel ainda não foi configurado." }, 503);
  }

  const requestedPeriod = Number(new URL(request.url).searchParams.get("days") ?? "30");
  if (!PERIODS.has(requestedPeriod)) {
    return jsonResponse({ error: "Período inválido. Use 7, 30 ou 90 dias." }, 400);
  }
  const period = requestedPeriod as 7 | 30 | 90;

  try {
    const now = new Date();
    const store = getStore({ name: "viviane-analytics", consistency: "strong" });
    const keys = await listKeys(store, utcDatePrefixes(period, now));
    const { events, ignored } = await readEvents(store, keys);
    return jsonResponse(buildAnalyticsReport(events, period, now, ignored));
  } catch (error) {
    console.error("analytics_report_failed", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonResponse({ error: "Não foi possível carregar os dados agora." }, 503);
  }
}

export const config: Config = {
  path: "/api/analytics/report",
  method: "GET",
};
