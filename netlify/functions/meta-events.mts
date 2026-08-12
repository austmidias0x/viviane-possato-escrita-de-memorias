import type { Config } from "@netlify/functions";

import { clientIp, parseMetaBrowserEvent } from "./_shared/meta-events.mts";
import { isSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from "./_shared/http.mts";

const MAXIMUM_BODY_BYTES = 4 * 1024;
const DEFAULT_DATASET_ID = "1091512559548489";
const DEFAULT_GRAPH_VERSION = "v25.0";

function configuredValue(name: string): string {
  return Netlify.env.get(name)?.trim() || "";
}

export default async function metaEvents(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Origem não permitida." }, 403);

  const body = await readJsonBody(request, MAXIMUM_BODY_BYTES);
  if (!body.ok) return body.response;
  const parsed = parseMetaBrowserEvent(body.value);
  if (!parsed.ok) return jsonResponse({ error: parsed.error }, 400);

  const accessToken = configuredValue("META_CONVERSIONS_ACCESS_TOKEN");
  if (!accessToken) return jsonResponse({ error: "Conversions API não configurada." }, 503);

  const datasetId = configuredValue("META_DATASET_ID") || DEFAULT_DATASET_ID;
  const graphVersion = configuredValue("META_GRAPH_API_VERSION") || DEFAULT_GRAPH_VERSION;
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || undefined;
  const ip = clientIp(request);
  const userData: Record<string, string> = {};
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;
  if (parsed.event.fbp) userData.fbp = parsed.event.fbp;
  if (parsed.event.fbc) userData.fbc = parsed.event.fbc;

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(datasetId)}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token: accessToken,
        data: [{
          event_name: parsed.event.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: parsed.event.event_id,
          action_source: "website",
          event_source_url: parsed.event.event_source_url,
          user_data: userData,
        }],
      }),
    });

    if (!response.ok) {
      console.error("meta_capi_request_failed", { status: response.status, eventName: parsed.event.event_name });
      return jsonResponse({ error: "A Meta recusou o evento." }, 502);
    }
  } catch (error) {
    console.error("meta_capi_unavailable", {
      eventName: parsed.event.event_name,
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonResponse({ error: "Conversions API indisponível." }, 503);
  }

  return jsonResponse({ accepted: true }, 202);
}

export const config: Config = {
  path: "/api/meta/events",
  method: "POST",
};
