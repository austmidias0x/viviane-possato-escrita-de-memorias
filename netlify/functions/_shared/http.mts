export const JSON_HEADERS = {
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...headers,
    },
  });
}

export function methodNotAllowed(allowed: string): Response {
  return jsonResponse(
    { error: "Método não permitido." },
    405,
    { Allow: allowed },
  );
}

export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const requestOrigin = new URL(request.url).origin;
    return new URL(origin).origin === requestOrigin;
  } catch {
    return false;
  }
}

export async function readJsonBody(
  request: Request,
  maximumBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return {
      ok: false,
      response: jsonResponse({ error: "Envie o corpo como application/json." }, 415),
    };
  }

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return {
      ok: false,
      response: jsonResponse({ error: "Corpo acima do limite permitido." }, 413),
    };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      ok: false,
      response: jsonResponse({ error: "Não foi possível ler o corpo da requisição." }, 400),
    };
  }

  if (new TextEncoder().encode(text).byteLength > maximumBytes) {
    return {
      ok: false,
      response: jsonResponse({ error: "Corpo acima do limite permitido." }, 413),
    };
  }

  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: jsonResponse({ error: "JSON inválido." }, 400),
    };
  }
}
