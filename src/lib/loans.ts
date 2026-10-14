import type { FinanceRecord, LoanInstallment, LoanType } from "@/types/finance";

const round2 = (value: number) => Math.round(value * 100) / 100;

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);

function addMonths(isoDate: string, months: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

export function generateSchedule(input: {
  principal: number;
  annualRate: number;
  months: number;
  type: Exclude<LoanType, "custom">;
  firstDate: string;
  monthlyFees?: number;
}): LoanInstallment[] {
  const { principal, annualRate, months, type, firstDate, monthlyFees = 0 } = input;
  const r = annualRate / 100 / 12;
  const rows: LoanInstallment[] = [];
  let balance = principal;
  const frenchPayment = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));

  for (let n = 1; n <= months; n += 1) {
    const interest = round2(balance * r);
    let cap = type === "french" ? frenchPayment - balance * r : principal / months;
    cap = n === months ? balance : round2(cap);
    balance = round2(balance - cap);
    rows.push({
      n,
      date: addMonths(firstDate, n - 1),
      principal: cap,
      interest,
      fees: monthlyFees,
      payment: round2(cap + interest + monthlyFees),
      balance: Math.max(balance, 0),
    });
  }
  return rows;
}

function parseNumber(raw: string) {
  let t = raw.replace(/[^\d.,-]/g, "");
  if (!t || t === "-") return NaN;
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    t = lastComma > lastDot ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = t.length - lastComma - 1;
    t = decimals === 3 && t.indexOf(",") === lastComma ? t.replace(",", "") : t.replace(",", ".");
  }
  return Number(t);
}

function parseDate(raw: string) {
  const t = raw.trim();
  let m = t.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

const columnMatchers: [keyof LoanInstallment | "fees", RegExp][] = [
  ["n", /^(n|no|nro|num|numero|sec|sec\.)[.°º]?\s*(de\s*)?(cuota|pago)?$|^#$|^periodo$|^mes$/],
  ["balance", /saldo|balance|pendiente|insoluto|reducido/],
  ["principal", /capital|amortiz|principal/],
  ["interest", /interes|interest/],
  ["fees", /seguro|comision|cargo|otros|fee|gasto/],
  ["payment", /cuota|pago|total|payment|valor/],
  ["date", /fecha|vencim|date/],
];

export function parseScheduleText(text: string): { rows: LoanInstallment[]; error?: string } {
  let lines = text.split(/\r?\n/).filter((l) => l.trim());
  // Los PDF traen título y datos del cliente antes de la tabla: se parte desde la fila de encabezados.
  const headerAt = lines.findIndex((l) => {
    const keys = new Set<string>();
    for (const cell of l.split(/[;\t,]/).map(norm)) {
      const hit = columnMatchers.find(([key, re]) => !keys.has(key) && re.test(cell));
      if (hit) keys.add(hit[0]);
    }
    return keys.size >= 4 && keys.has("date");
  });
  if (headerAt > 0) lines = lines.slice(headerAt);
  if (lines.length < 2) return { rows: [], error: "Pega o carga al menos el encabezado y una fila." };
  const sep = [";", "\t", ","].map((s) => [s, lines[0].split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
  const headers = split(lines[0]).map(norm);

  const index: Partial<Record<string, number>> = {};
  headers.forEach((h, i) => {
    const hit = columnMatchers.find(([key, re]) => index[key] === undefined && re.test(h));
    if (hit) index[hit[0]] = i;
  });
  if (index.date === undefined || index.balance === undefined || (index.principal === undefined && index.payment === undefined)) {
    return { rows: [], error: "No encontré las columnas. Necesito al menos: fecha, capital (o cuota) y saldo, con encabezados en la primera fila." };
  }

  const num = (cells: string[], key: string) => (index[key] === undefined ? 0 : parseNumber(cells[index[key]!] ?? ""));
  const rows: LoanInstallment[] = [];
  for (const line of lines.slice(1)) {
    const cells = split(line);
    const date = parseDate(cells[index.date!] ?? "");
    const balance = num(cells, "balance");
    if (!date || Number.isNaN(balance)) continue;
    const interest = num(cells, "interest") || 0;
    const fees = num(cells, "fees") || 0;
    let principal = num(cells, "principal");
    let payment = num(cells, "payment");
    if (Number.isNaN(principal)) principal = round2(payment - interest - fees);
    if (Number.isNaN(payment) || index.payment === undefined) payment = round2(principal + interest + fees);
    rows.push({ n: rows.length + 1, date, payment: round2(payment), principal: round2(principal), interest: round2(interest), fees: round2(fees), balance: round2(balance) });
  }
  if (!rows.length) return { rows: [], error: "No pude leer ninguna fila válida (revisa fechas y números)." };
  rows.sort((a, b) => a.date.localeCompare(b.date));
  rows.forEach((r, i) => { r.n = i + 1; });
  return { rows };
}

export function extractRate(text: string) {
  const m = text.match(/tasa[^;\n\d]*[;:\s]*(\d{1,3}(?:[.,]\d+)?)/i);
  return m ? Number(m[1].replace(",", ".")) : undefined;
}

export function summarize(schedule: LoanInstallment[], today: string) {
  const sum = (rows: LoanInstallment[], key: "payment" | "principal" | "interest" | "fees") => rows.reduce((t, r) => t + r[key], 0);
  const paid = schedule.filter((r) => r.paid);
  const pending = schedule.filter((r) => !r.paid);
  const next = pending[0];
  const lastPaid = paid[paid.length - 1];
  const first = schedule[0];
  const principalTotal = sum(schedule, "principal");
  return {
    paidCount: paid.length,
    pendingCount: pending.length,
    next,
    nextOverdue: next ? next.date < today : false,
    overdueCount: pending.filter((r) => r.date < today).length,
    balance: lastPaid ? lastPaid.balance : first ? round2(first.balance + first.principal) : 0,
    principalPaid: sum(paid, "principal"),
    interestPaid: sum(paid, "interest"),
    interestRemaining: sum(pending, "interest"),
    interestTotal: sum(schedule, "interest"),
    feesTotal: sum(schedule, "fees"),
    totalCost: sum(schedule, "payment"),
    totalPaid: sum(paid, "payment"),
    principalTotal,
    endDate: schedule[schedule.length - 1]?.date,
  };
}

// Calcula con la tasa implícita de la tabla cuánto se ahorra abonando un extra fijo cada mes.
export function simulateExtra(schedule: LoanInstallment[], extra: number, type: LoanType = "french") {
  const pending = schedule.filter((r) => !r.paid);
  if (!pending.length || extra <= 0) return null;
  const startBalance = round2(pending[0].balance + pending[0].principal);
  const rate = startBalance > 0 ? pending[0].interest / startBalance : 0;
  const basePayment = pending[0].payment - pending[0].fees;
  const fees = pending[0].fees;
  let balance = startBalance;
  let interestTotal = 0;
  let months = 0;
  while (balance > 0.005 && months < 1200) {
    const interest = balance * rate;
    const scheduled = type === "german" ? pending[0].principal : Math.max(basePayment - interest, 0);
    const principal = Math.min(balance, scheduled + extra);
    if (principal <= 0) return null;
    balance -= principal;
    interestTotal += interest;
    months += 1;
  }
  const baseInterest = pending.reduce((t, r) => t + r.interest, 0);
  return {
    months,
    monthsSaved: pending.length - months,
    interestSaved: Math.max(baseInterest - interestTotal, 0),
    fees,
  };
}

export const loanSchedule = (record: FinanceRecord) => record.schedule ?? [];
