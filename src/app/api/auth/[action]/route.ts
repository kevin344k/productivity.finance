import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const COOKIE = "mp_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function cookieHeader(value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

async function callApi(path: string, init: RequestInit) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return Response.json({ error: "API_URL no configurado" }, { status: 500 });
  try {
    return await fetch(`${apiUrl.replace(/\/$/, "")}${path}`, { ...init, cache: "no-store" });
  } catch {
    return Response.json({ error: "API no disponible" }, { status: 502 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if ((await params).action !== "me") return Response.json({ error: "No encontrado" }, { status: 404 });
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return Response.json({ error: "Sin sesión" }, { status: 401 });
  const upstream = await callApi("/me", { headers: { Authorization: `Bearer ${token}` } });
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (upstream.status === 401) headers["Set-Cookie"] = cookieHeader("", 0);
  return new Response(await upstream.text(), { status: upstream.status, headers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;

  if (action === "logout") {
    return new Response(null, { status: 204, headers: { "Set-Cookie": cookieHeader("", 0) } });
  }
  if (!["login", "register", "google"].includes(action)) {
    return Response.json({ error: "No encontrado" }, { status: 404 });
  }

  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const upstream = await callApi(`/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(forwarded ? { "X-Client-IP": forwarded } : {}) },
    body: await req.text(),
  });
  const data = await upstream.json().catch(() => ({ error: "Respuesta inválida" }));
  if (!upstream.ok) return Response.json({ error: data.error ?? "Error" }, { status: upstream.status });

  return new Response(JSON.stringify({ user: data.user }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookieHeader(data.token, MAX_AGE) },
  });
}
