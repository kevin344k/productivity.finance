import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

async function forward(req: NextRequest, { params }: { params: Promise<{ path?: string[] }> }) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) return Response.json({ error: "API_URL no configurado" }, { status: 500 });
  const token = req.cookies.get("mp_session")?.value;
  if (!token) return Response.json({ error: "Sin sesión" }, { status: 401 });
  const { path = [] } = await params;
  const target = `${apiUrl.replace(/\/$/, "")}/${path.map(encodeURIComponent).join("/")}`;
  const hasBody = req.method !== "GET" && req.method !== "DELETE";
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
    });
    return new Response(upstream.status === 204 ? null : upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json({ error: "API no disponible" }, { status: 502 });
  }
}

export { forward as GET, forward as PUT, forward as DELETE };
