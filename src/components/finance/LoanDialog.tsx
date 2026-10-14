"use client";

import { useMemo, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { localDateString } from "@/lib/format";
import { extractRate, generateSchedule, money, parseScheduleText } from "@/lib/loans";
import { withSchedule } from "@/components/finance/LoansModule";
import type { FinanceRecord, LoanInstallment, LoanType } from "@/types/finance";

type Source = "generate" | "table";

export function LoanDialog({
  loan,
  onClose,
  onSave,
}: {
  loan: FinanceRecord | null;
  onClose: () => void;
  onSave: (record: FinanceRecord) => Promise<void>;
}) {
  const [name, setName] = useState(loan?.name ?? "");
  const [lender, setLender] = useState(loan?.lender ?? "");
  const [source, setSource] = useState<Source>(loan?.loanType === "custom" ? "table" : "generate");
  const [type, setType] = useState<Exclude<LoanType, "custom">>(loan?.loanType === "german" ? "german" : "french");
  const [principal, setPrincipal] = useState(String(loan?.principalAmount ?? loan?.targetAmount ?? ""));
  const [rate, setRate] = useState(String(loan?.interestRate ?? ""));
  const [months, setMonths] = useState(String(loan?.termMonths ?? ""));
  const [firstDate, setFirstDate] = useState(loan?.schedule?.[0]?.date ?? localDateString());
  const [fees, setFees] = useState(String(loan?.schedule?.[0]?.fees ?? ""));
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const parsed = useMemo(() => (source === "table" && text.trim() ? parseScheduleText(text) : null), [source, text]);

  const generated = useMemo<LoanInstallment[]>(() => {
    const p = Number(principal);
    const m = Number(months);
    if (source !== "generate" || !(p > 0) || !(m >= 1) || m > 600 || !firstDate) return [];
    return generateSchedule({ principal: p, annualRate: Number(rate) || 0, months: Math.round(m), type, firstDate, monthlyFees: Number(fees) || 0 });
  }, [source, principal, months, rate, type, firstDate, fees]);

  // Conserva las cuotas ya marcadas como pagadas si el préstamo se edita y sigue siendo compatible.
  const keepPaid = (rows: LoanInstallment[]) =>
    rows.map((r, i) => ({ ...r, paid: loan?.schedule?.[i]?.paid ?? false }));

  const onFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const { pdfToText } = await import("@/lib/pdfTable");
        const extracted = await pdfToText(await file.arrayBuffer());
        setText(extracted);
        const detected = extractRate(extracted);
        if (detected !== undefined && rate === "") setRate(String(detected));
      } else {
        setText(await file.text());
      }
    } catch {
      setError("No pude leer el archivo. Prueba con un CSV o pega la tabla.");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Escribe un nombre para el préstamo.");
    let schedule: LoanInstallment[];
    if (source === "generate") {
      if (!generated.length) return setError("Completa monto, plazo y fecha de la primera cuota.");
      schedule = generated;
    } else {
      if (!parsed || parsed.error) return setError(parsed?.error ?? "Pega o carga la tabla de amortización.");
      schedule = parsed.rows;
    }
    setSaving(true);
    try {
      const base: FinanceRecord = {
        id: loan?.id ?? crypto.randomUUID(),
        kind: "loan",
        name: name.trim(),
        category: lender.trim() || "Préstamos",
        lender: lender.trim() || undefined,
        loanType: source === "table" ? "custom" : type,
        interestRate: rate === "" ? undefined : Number(rate),
        amount: 1,
        date: schedule[0].date,
      };
      await onSave(withSchedule(base, keepPaid(schedule)));
      onClose();
    } catch {
      setError("No se pudo guardar. Revisa que la API esté encendida.");
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Préstamo">
      <form className="dialog record-form" onSubmit={submit} style={{ width: "min(100%, 560px)", maxHeight: "92vh" }}>
        <div className="dialog-head">
          <div><div className="eyebrow">PRÉSTAMO</div><h2>{loan ? "Editar préstamo" : "Nuevo préstamo"}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>

        <div className="form-row">
          <label className="field-label">Nombre
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Crédito del auto" />
          </label>
          <label className="field-label">Banco o entidad
            <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Ej. Banco Pichincha" />
          </label>
        </div>

        <div className="filter-pills">
          <button type="button" className={`filter-pill ${source === "generate" ? "selected" : ""}`} onClick={() => setSource("generate")}>Calcular tabla</button>
          <button type="button" className={`filter-pill ${source === "table" ? "selected" : ""}`} onClick={() => setSource("table")}>Cargar tabla del banco (recomendado)</button>
        </div>

        {source === "generate" ? (
          <>
            <div className="form-row">
              <label className="field-label">Sistema
                <select value={type} onChange={(e) => setType(e.target.value as "french" | "german")}>
                  <option value="french">Francés (cuota fija)</option>
                  <option value="german">Alemán (capital fijo)</option>
                </select>
              </label>
              <label className="field-label">Monto prestado
                <input type="number" min="0" step="0.01" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="field-label">Tasa anual (%)
                <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              </label>
              <label className="field-label">Plazo (meses)
                <input type="number" min="1" max="600" step="1" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="field-label">Fecha de la primera cuota
                <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} />
              </label>
              <label className="field-label">Seguro/cargos por cuota
                <input type="number" min="0" step="0.01" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />
              </label>
            </div>
            {generated.length > 0 && (
              <div className="loan-preview">
                Cuota {type === "french" ? "fija" : "inicial"}: <strong>{money(generated[0].payment)}</strong>
                {type === "german" && <> · última: <strong>{money(generated[generated.length - 1].payment)}</strong></>}
                {" "}· interés total: <strong>{money(generated.reduce((t, r) => t + r.interest, 0))}</strong>
                <small>Es un cálculo teórico: puede diferir unos centavos de lo que te cobra el banco. Para cifras exactas, carga su tabla.</small>
              </div>
            )}
          </>
        ) : (
          <>
            <label className="field-label">Tasa anual (%) <span className="optional-label">OPCIONAL, SOLO INFORMATIVA</span>
              <input type="number" min="0" max="100" step="0.01" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </label>
            <label className="field-label">Archivo de la tabla (PDF o CSV)
              <input type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            <label className="field-label">…o pega la tabla aquí (desde Excel o el PDF del banco)
              <textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={"N°;Fecha;Cuota;Capital;Interés;Seguro;Saldo\n1;15/01/2026;1050,50;800,00;200,50;50,00;9200,00"} />
            </label>
            <small className="loan-hint">Con el PDF del banco basta con subirlo. Si usas CSV o pegas texto, la primera fila debe tener encabezados: fecha, capital (o cuota) y saldo; interés y seguros son opcionales.</small>
            {parsed && !parsed.error && <div className="loan-preview">Leí <strong>{parsed.rows.length} cuotas</strong> · primera: <strong>{money(parsed.rows[0].payment)}</strong> el {parsed.rows[0].date} · interés total <strong>{money(parsed.rows.reduce((t, r) => t + r.interest, 0))}</strong></div>}
            {parsed?.error && <span className="field-error">{parsed.error}</span>}
          </>
        )}

        {error && <span className="field-error" role="alert">{error}</span>}
        <button className="primary-button dialog-submit" type="submit" disabled={saving}>{saving ? "Guardando..." : "Guardar préstamo"}</button>
      </form>
    </div>
  );
}
