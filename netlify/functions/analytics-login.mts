import type { Config } from "@netlify/functions";

import {
  createAnalyticsSession,
  getAnalyticsPassword,
  safeSecretEqual,
  sessionCookie,
} from "./_shared/auth.mts";
import { isSameOrigin, jsonResponse, methodNotAllowed, readJsonBody } from "./_shared/http.mts";

export default async function analyticsLogin(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed("POST");
  if (!isSameOrigin(request)) return jsonResponse({ error: "Origem não permitida." }, 403);

  const body = await readJsonBody(request, 2 * 1024);
  if (!body.ok) return body.response;
  if (
    typeof body.value !== "object" ||
    body.value === null ||
    Array.isArray(body.value) ||
    Object.keys(body.value).some((key) => key !== "password") ||
    typeof (body.value as { password?: unknown }).password !== "string"
  ) {
    return jsonResponse({ error: "Informe a senha." }, 400);
  }

  try {
    const candidate = (body.value as { password: string }).password;
    const password = getAnalyticsPassword();
    if (!safeSecretEqual(candidate, password)) {
      return jsonResponse({ error: "Senha incorreta." }, 401);
    }

    return jsonResponse(
      { authenticated: true },
      200,
      { "Set-Cookie": sessionCookie(createAnalyticsSession()) },
    );
  } catch (error) {
    console.error("analytics_auth_configuration_error", {
      message: error instanceof Error ? error.message : "unknown_error",
    });
    return jsonResponse({ error: "O acesso ao painel ainda não foi configurado." }, 503);
  }
}

export const config: Config = {
  path: "/api/analytics/login",
  method: "POST",
};
