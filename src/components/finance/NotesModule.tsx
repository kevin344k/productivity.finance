"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Plus, Search, Trash2, X } from "lucide-react";
import { localDateString } from "@/lib/format";
import { money } from "@/lib/loans";
import type { FinanceRecord, NoteItem } from "@/types/finance";

const COLORS = ["yellow", "green", "blue", "pink", "purple", "orange", "gray", "slate", "charcoal"] as const;

const shortDate = (value: string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(`${value}T12:00:00`));

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.remove();
  const palette = ["#f5c542", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa", "#fb923c"];
  const pieces = Array.from({ length: 160 }, () => ({
    x: canvas.width / 2,
    y: canvas.height * 0.6,
    vx: (Math.random() - 0.5) * 18,
    vy: -Math.random() * 18 - 4,
    size: 6 + Math.random() * 6,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of pieces) {
      p.vy += 0.35;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 3200);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < 3200) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}

function NoteCard({
  note,
  onSave,
  onRemove,
}: {
  note: FinanceRecord;
  onSave: (record: FinanceRecord) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(note);
  const [newItem, setNewItem] = useState("");
  const today = localDateString();

  useEffect(() => setDraft(note), [note]);

  const items = draft.items ?? [];
  const done = items.filter((i) => i.done).length;
  const total = items.reduce((sum, i) => sum + (i.budget ?? 0), 0);
  const pending = items.filter((i) => !i.done).reduce((sum, i) => sum + (i.budget ?? 0), 0);
  const complete = items.length > 0 && done === items.length;

  const commit = (next: FinanceRecord) => {
    const wasComplete = (draft.items ?? []).length > 0 && (draft.items ?? []).every((i) => i.done);
    const nowComplete = (next.items ?? []).length > 0 && (next.items ?? []).every((i) => i.done);
    if (nowComplete && !wasComplete) fireConfetti();
    setDraft(next);
    void onSave(next);
  };

  const patchItem = (id: string, patch: Partial<NoteItem>, save: boolean) => {
    const next = { ...draft, items: items.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
    if (save) commit(next);
    else setDraft(next);
  };

  const addItem = () => {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    commit({ ...draft, items: [...items, { id: crypto.randomUUID(), text, done: false }] });
  };

  return (
    <article className={`note-card note-${draft.color ?? "yellow"} ${complete ? "is-complete" : ""}`}>
      <div className="note-head">
        <input
          className="note-title"
          value={draft.name}
          placeholder="Título"
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          onBlur={() => draft.name !== note.name && commit({ ...draft, name: draft.name.trim() || "Sin título" })}
        />
        <button className="note-icon" aria-label="Eliminar nota" onClick={() => window.confirm("¿Eliminar esta nota?") && void onRemove(note.id)}>
          <Trash2 size={15} />
        </button>
      </div>

      <div className="note-colors">
        {COLORS.map((c) => (
          <button key={c} className={`note-dot note-${c} ${draft.color === c || (!draft.color && c === "yellow") ? "selected" : ""}`} aria-label={`Color ${c}`} onClick={() => commit({ ...draft, color: c })} />
        ))}
      </div>

      <textarea
        className="note-body"
        value={draft.body ?? ""}
        placeholder="Apuntes, claves, datos (RUC, enlaces...)"
        rows={draft.body ? Math.min(8, draft.body.split("\n").length + 1) : 2}
        onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        onBlur={() => (draft.body ?? "") !== (note.body ?? "") && commit(draft)}
      />

      {items.length > 0 && (
        <div className="note-progress">
          <div className="note-bar"><span style={{ width: `${(done / items.length) * 100}%` }} /></div>
          <small>{done}/{items.length}{complete ? " · ¡Completo! 🎉" : ""}</small>
        </div>
      )}

      <ul className="note-items">
        {items.map((item) => (
          <li key={item.id} className={item.done ? "is-done" : ""}>
            <input type="checkbox" checked={item.done} onChange={() => patchItem(item.id, { done: !item.done }, true)} aria-label="Completado" />
            <div className="note-item-main">
              <input
                className="note-item-text"
                value={item.text}
                onChange={(e) => patchItem(item.id, { text: e.target.value }, false)}
                onBlur={() => commit(draft)}
              />
              <div className="note-item-meta">
                <label className={item.due && !item.done && item.due < today ? "is-overdue" : ""}>
                  <CalendarDays size={13} />
                  <input type="date" value={item.due ?? ""} onChange={(e) => patchItem(item.id, { due: e.target.value || undefined }, true)} />
                  {item.due && <em>{shortDate(item.due)}</em>}
                </label>
                <label>
                  $
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Presupuesto"
                    value={item.budget ?? ""}
                    onChange={(e) => patchItem(item.id, { budget: e.target.value === "" ? undefined : Number(e.target.value) }, false)}
                    onBlur={() => commit(draft)}
                  />
                </label>
              </div>
            </div>
            <button className="note-icon" aria-label="Quitar punto" onClick={() => commit({ ...draft, items: items.filter((i) => i.id !== item.id) })}>
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>

      <div className="note-add">
        <input value={newItem} placeholder="Agregar punto…" onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
        <button onClick={addItem} aria-label="Agregar punto"><Plus size={16} /></button>
      </div>

      {total > 0 && (
        <div className="note-budget">
          <span>Presupuesto total <strong>{money(total)}</strong></span>
          <span>Pendiente <strong>{money(pending)}</strong></span>
        </div>
      )}
    </article>
  );
}

export function NotesModule({
  notes,
  onSave,
  onRemove,
}: {
  notes: FinanceRecord[];
  onSave: (record: FinanceRecord) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...notes]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((n) => !q || `${n.name} ${n.body ?? ""} ${(n.items ?? []).map((i) => i.text).join(" ")}`.toLowerCase().includes(q));
  }, [notes, query]);

  const create = async () => {
    setCreating(true);
    await onSave({
      id: crypto.randomUUID(),
      kind: "note",
      name: "Nueva nota",
      category: "Nota",
      amount: 0,
      date: localDateString(),
      color: COLORS[notes.length % COLORS.length],
      body: "",
      items: [],
    });
    setCreating(false);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="notes-page" ref={topRef}>
      <div className="notes-toolbar">
        <label className="notes-search">
          <Search size={16} />
          <input value={query} placeholder="Buscar en notas…" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <button className="primary-button" onClick={() => void create()} disabled={creating}>
          <Plus size={16} /> Nueva nota
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="panel notes-empty">Aún no tienes notas. Crea una para guardar pendientes, claves o datos importantes.</div>
      ) : (
        <div className="notes-grid">
          {visible.map((note) => (
            <NoteCard key={note.id} note={note} onSave={onSave} onRemove={onRemove} />
          ))}
        </div>
      )}
    </div>
  );
}
