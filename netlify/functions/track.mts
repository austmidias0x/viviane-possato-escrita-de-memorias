import { getStore } from "@netlify/blobs";
import type { Config } from "@netlify/functions";

import { analyticsBlobKey, parseAnalyticsEvent } from "./_shared/analytics-schema.mts";
import { isSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from "./_shared/http.mts";

const MAXIMUM_BODY_BYTES = 8 * 1024;

export default async function track(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Origem não permitida." }, 403);

  const body = await readJsonBody(request, MAXIMUM_BODY_BYTES);
  if (!body.ok) return body.response;

  const parsed = parseAnalyticsEvent(body.value);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);

  try {
    const store = getStore({ name: "viviane-analytics" });
    await store.setJSON(analyticsBlobKey(parsed.event), parsed.event);
  } catch (error) {
    console.error("analytics_write_failed", {
      eventId: parsed.event.event_id,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonResponse({ error: "Não foi possível registrar o evento." }, 503);
  }

  return jsonResponse({ accepted: true }, 202);
}

export const config: Config = {
  path: "/api/track",
  method: "POST",
};
