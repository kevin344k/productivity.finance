"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight, CreditCard, Edit2, X } from "lucide-react";
import { formatDate, localDateString } from "@/lib/format";
import { money, simulateExtra, summarize } from "@/lib/loans";
import type { FinanceRecord, LoanType } from "@/types/finance";

const typeLabel: Record<LoanType, string> = { french: "Francés", german: "Alemán", custom: "Tabla del banco" };

const fullDate = (value: string) =>
  new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));

export const paymentExpenseId = (loanId: string, n: number) => `loanpay-${loanId}-${n}`;

export function withSchedule(loan: FinanceRecord, schedule: NonNullable<FinanceRecord["schedule"]>): FinanceRecord {
  const s = summarize(schedule, localDateString());
  const nextDay = s.next ? Number(s.next.date.slice(8, 10)) : undefined;
  return {
    ...loan,
    schedule,
    amount: s.balance,
    targetAmount: s.principalTotal,
    principalAmount: s.principalTotal,
    termMonths: schedule.length,
    date: schedule[0]?.date ?? loan.date,
    endDate: s.endDate,
    dueDay: nextDay,
  };
}

function LoanCard({
  loan,
  onSave,
  onRemove,
  onEdit,
  onDelete,
}: {
  loan: FinanceRecord;
  onSave: (record: FinanceRecord) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEdit: (record: FinanceRecord) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const today = localDateString();
  const schedule = loan.schedule ?? [];
  const s = useMemo(() => summarize(schedule, today), [schedule, today]);
  const sim = useMemo(() => simulateExtra(schedule, Number(extra) || 0, loan.loanType), [schedule, extra, loan.loanType]);
  const percent = s.principalTotal > 0 ? Math.min((s.principalPaid / s.principalTotal) * 100, 100) : 0;

  // El banco solo permite pagar en la fecha de la cuota: se marca en orden, de a una.
  const firstPending = schedule.find((r) => !r.paid)?.n;
  const lastPaid = [...schedule].reverse().find((r) => r.paid)?.n;

  const togglePaid = async (n: number) => {
    const target = schedule.find((r) => r.n === n);
    if (!target) return;
    const next = schedule.map((r) => (r.n === n ? { ...r, paid: !r.paid } : r));
    const expenseId = paymentExpenseId(loan.id, n);
    if (target.paid) {
      await onRemove(expenseId);
    } else {
      await onSave({
        id: expenseId,
        kind: "expense",
        name: `${loan.name} · cuota ${n}`,
        category: "Préstamos",
        amount: target.payment,
        date: today,
        description: `Pago de la cuota ${n} de ${loan.name}`,
      });
    }
    await onSave(withSchedule(loan, next));
  };

  const chartData = schedule.map((r) => ({ n: r.n, Capital: r.principal, Interés: r.interest, Cargos: r.fees }));
  const stats: [string, string][] = [
    ["Saldo pendiente", money(s.balance)],
    ["Capital pagado", money(s.principalPaid)],
    ["Interés pagado", money(s.interestPaid)],
    ["Interés por pagar", money(s.interestRemaining)],
    ["Costo total del crédito", money(s.totalCost)],
    ["Cuotas restantes", `${s.pendingCount} de ${schedule.length}`],
  ];

  return (
    <div className="loan-card">
      <div className="loan-title">
        <div className="movement-icon blue"><CreditCard size={18} /></div>
        <div>
          <strong>{loan.name}</strong>
          <span>{loan.lender ? `${loan.lender} · ` : ""}{typeLabel[loan.loanType ?? "custom"]} · {loan.interestRate ?? 0}% anual</span>
        </div>
        <button className="delete-record" onClick={() => onEdit(loan)} aria-label={`Editar ${loan.name}`}><Edit2 size={15} /></button>
        <button className="delete-record" onClick={() => onDelete(loan.id)} aria-label={`Eliminar ${loan.name}`}><X size={16} /></button>
      </div>

      <div className="loan-next">
        {s.next ? (
          <>
            <div><span>Próxima cuota</span><strong>{money(s.next.payment)}</strong></div>
            <div><span>Vence</span><strong>{fullDate(s.next.date)}</strong></div>
            {s.nextOverdue && <em className="loan-badge danger">{s.overdueCount} vencida{s.overdueCount > 1 ? "s" : ""}</em>}
          </>
        ) : (
          <div><span>Estado</span><strong>Préstamo pagado por completo</strong></div>
        )}
      </div>

      <div className="progress-track loan-progress"><span className="progress-fill blue" style={{ width: `${percent}%` }} /></div>
      <span className="loan-percent">{Math.round(percent)}% del capital pagado · termina {s.endDate ? fullDate(s.endDate) : "—"}</span>

      <div className="loan-stats">
        {stats.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}
      </div>

      <button className="loan-toggle" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />} {open ? "Ocultar" : "Ver"} tabla de amortización y análisis
      </button>

      {open && (
        <>
          <div className="loan-chart">
            <h3>Capital e interés de cada cuota</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="n" axisLine={false} tickLine={false} tick={{ fill: "var(--chart-tick)", fontSize: 13 }} />
                <YAxis axisLine={false} tickLine={false} width={62} tick={{ fill: "var(--chart-tick)", fontSize: 13 }} tickFormatter={(v) => money(Number(v)).replace(/\.00$/, "")} />
                <Tooltip
                  contentStyle={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 12, color: "var(--chart-tooltip-text)", fontSize: 14 }}
                  formatter={(value) => money(Number(value))}
                  labelFormatter={(n) => `Cuota ${n}`}
                />
                <Bar dataKey="Capital" stackId="a" fill="#3b82f6" />
                <Bar dataKey="Interés" stackId="a" fill="#f59e0b" />
                <Bar dataKey="Cargos" stackId="a" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="loan-legend"><i style={{ background: "#3b82f6" }} />Capital <i style={{ background: "#f59e0b" }} />Interés <i style={{ background: "#8b5cf6" }} />Seguros y cargos</div>
          </div>

          {s.pendingCount > 0 && (
            <div className="loan-sim">
              <h3>¿Y si abonas más cada mes?</h3>
              <label className="field-label">Abono extra mensual
                <input type="number" min="0" step="10" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ej. 100" />
              </label>
              {sim && (
                <p>Terminarías en <strong>{sim.months} cuotas</strong> ({sim.monthsSaved} menos) y ahorrarías aprox. <strong>{money(sim.interestSaved)}</strong> en intereses. Es una estimación: confirma con tu banco cómo aplica los abonos (reducir plazo o cuota).</p>
              )}
            </div>
          )}

          <div className="sched-wrap">
            <table className="sched-table">
              <thead><tr><th>Pagada</th><th>N°</th><th>Fecha</th><th>Cuota</th><th>Capital</th><th>Interés</th><th>Cargos</th><th>Saldo</th></tr></thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.n} className={r.paid ? "is-paid" : r.date < today ? "is-overdue" : ""}>
                    <td><input type="checkbox" checked={!!r.paid} disabled={r.paid ? r.n !== lastPaid : r.n !== firstPending} onChange={() => void togglePaid(r.n)} aria-label={`Cuota ${r.n} pagada`} /></td>
                    <td>{r.n}</td><td>{formatDate(r.date)} {r.date.slice(0, 4)}</td>
                    <td><strong>{money(r.payment)}</strong></td><td>{money(r.principal)}</td><td>{money(r.interest)}</td><td>{money(r.fees)}</td><td>{money(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function LoansModule({
  loans,
  onSave,
  onRemove,
  onEdit,
  onDelete,
  monthlyIncome,
  monthlySubscriptions,
}: {
  loans: FinanceRecord[];
  onSave: (record: FinanceRecord) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEdit: (record: FinanceRecord) => void;
  onDelete: (id: string) => void;
  monthlyIncome: number;
  monthlySubscriptions: number;
}) {
  const today = localDateString();
  const month = today.slice(0, 7);
  const withTable = loans.filter((l) => l.schedule?.length);
  const legacy = loans.filter((l) => !l.schedule?.length);

  const totals = withTable.reduce(
    (acc, loan) => {
      const s = summarize(loan.schedule!, today);
      const due = loan.schedule!.filter((r) => !r.paid && r.date.slice(0, 7) <= month);
      acc.balance += s.balance;
      acc.interestLeft += s.interestRemaining;
      acc.monthly += due.reduce((t, r) => t + r.payment, 0);
      return acc;
    },
    { balance: 0, interestLeft: 0, monthly: 0 },
  );
  const committed = totals.monthly + monthlySubscriptions;
  const nextAll = withTable
    .map((l) => ({ l, next: summarize(l.schedule!, today).next }))
    .filter((x) => x.next)
    .sort((a, b) => a.next!.date.localeCompare(b.next!.date))[0];

  return (
    <>
      <div className="loan-summary">
        <div className="panel"><span>Cuotas de este mes</span><strong>{money(totals.monthly)}</strong><small>{monthlyIncome > 0 ? `${Math.round((committed / monthlyIncome) * 100)}% de tus ingresos con suscripciones` : "pendientes de pago"}</small></div>
        <div className="panel"><span>Deuda en préstamos</span><strong>{money(totals.balance)}</strong><small>{loans.length} préstamo{loans.length === 1 ? "" : "s"}</small></div>
        <div className="panel"><span>Interés por pagar</span><strong>{money(totals.interestLeft)}</strong><small>lo que aún le pagarás al banco</small></div>
        <div className="panel"><span>Próximo pago</span><strong>{nextAll ? money(nextAll.next!.payment) : "—"}</strong><small>{nextAll ? `${nextAll.l.name} · ${fullDate(nextAll.next!.date)}` : "sin cuotas pendientes"}</small></div>
      </div>

      {withTable.length > 1 && (
        <div className="panel module-panel">
          <div className="section-head"><div><h2>Comparativo</h2><p>Cuál te cuesta más y cuál conviene pagar primero</p></div></div>
          <div className="sched-wrap">
            <table className="sched-table">
              <thead><tr><th>Préstamo</th><th>Tasa</th><th>Saldo</th><th>Interés por pagar</th><th>Cuota mensual</th><th>Termina</th></tr></thead>
              <tbody>
                {withTable.slice().sort((a, b) => (b.interestRate ?? 0) - (a.interestRate ?? 0)).map((l) => {
                  const s = summarize(l.schedule!, today);
                  return <tr key={l.id}><td><strong>{l.name}</strong></td><td>{l.interestRate ?? 0}%</td><td>{money(s.balance)}</td><td>{money(s.interestRemaining)}</td><td>{s.next ? money(s.next.payment) : "—"}</td><td>{s.endDate ? fullDate(s.endDate) : "—"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="panel module-panel">
        <div className="section-head"><div><h2>Tus préstamos</h2><p>Cuotas, capital e interés mes a mes</p></div></div>
        {withTable.map((loan) => <LoanCard key={loan.id} loan={loan} onSave={onSave} onRemove={onRemove} onEdit={onEdit} onDelete={onDelete} />)}
        {legacy.map((loan) => (
          <div className="loan-card" key={loan.id}>
            <div className="loan-title">
              <div className="movement-icon blue"><CreditCard size={18} /></div>
              <div><strong>{loan.name}</strong><span>{loan.category} · {loan.interestRate ?? 0}% anual · saldo {money(loan.amount)}</span></div>
              <button className="loan-toggle inline" onClick={() => onEdit(loan)}>Agregar tabla de amortización</button>
              <button className="delete-record" onClick={() => onDelete(loan.id)} aria-label={`Eliminar ${loan.name}`}><X size={16} /></button>
            </div>
          </div>
        ))}
        {loans.length === 0 && <div className="empty-state"><p>Añade tu primer préstamo y carga la tabla de amortización de tu banco.</p></div>}
      </div>
    </>
  );
}
