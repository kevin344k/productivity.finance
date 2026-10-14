"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

export interface SessionUser {
  id: string;
  name: string;
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
      renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
    };
  };
}

async function postAuth(action: string, body: unknown): Promise<SessionUser> {
  const res = await fetch(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo completar la solicitud");
  return data.user;
}

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const googleRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onAuthenticated);
  callbackRef.current = onAuthenticated;

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    const setup = () => {
      const google = (window as unknown as { google?: GoogleIdentity }).google;
      if (!google || !googleRef.current) return;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          try {
            callbackRef.current(await postAuth("google", { credential }));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Error con Google");
          }
        },
      });
      google.accounts.id.renderButton(googleRef.current, { theme: "outline", size: "large", width: 300, text: "continue_with" });
    };
    if ((window as unknown as { google?: GoogleIdentity }).google) {
      setup();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = setup;
    document.head.appendChild(script);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      onAuthenticated(await postAuth(mode, { username, password }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="dialog" onSubmit={submit} style={{ display: "grid", gap: 14 }}>
        <div className="dialog-head" style={{ marginBottom: 4 }}>
          <div>
            <div className="eyebrow">MONEY PILOT</div>
            <h2>{mode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>
          </div>
        </div>
        <label className="field-label">Usuario
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required minLength={3} maxLength={32} />
        </label>
        <label className="field-label">Contraseña
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "register" ? 8 : 1} />
        </label>
        {error && <span className="field-error" role="alert">{error}</span>}
        <button className="primary-button" type="submit" disabled={busy} style={{ minHeight: 40, fontSize: 14 }}>
          {mode === "login" ? "Entrar" : "Registrarme"}
        </button>
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)" }}>o</div>
            <div ref={googleRef} style={{ display: "flex", justifyContent: "center" }} />
          </>
        )}
        <button type="button" className="insight-action" style={{ justifySelf: "center", fontSize: 13 }} onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}
