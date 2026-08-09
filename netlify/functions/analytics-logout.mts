import type { Config } from "@netlify/functions";

import { expiredSessionCookie } from "./_shared/auth.mts";
import { isSameOrigin, jsonResponse, methodNotAllowed } from "./_shared/http.mts";

export default function analyticsLogout(request: Request): Response {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Origem não permitida." }, 403);

  return jsonResponse(
    { authenticated: false },
    200,
    { "Set-Cookie": expiredSessionCookie() },
  );
}

export const config: Config = {
  path: "/api/analytics/logout",
  method: "POST",
};
