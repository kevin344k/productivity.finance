"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  Ban,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  Edit2,
  FileText,
  Goal,
  LayoutDashboard,
  Lightbulb,
  StickyNote,
  Menu,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { BalanceChart } from "@/components/finance/BalanceChart";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthScreen, type SessionUser } from "@/components/AuthScreen";
import { BrandLogo } from "@/components/finance/BrandLogo";
import { useFinanceStore } from "@/features/finance/store";
import { currency, formatDate, localDateString, nextChargeDate } from "@/lib/format";
import type { FinanceBackup, FinanceRecord, RecordKind } from "@/types/finance";

const NotesModule = dynamic(
  () => import("@/components/finance/NotesModule").then((mod) => mod.NotesModule),
  { ssr: false, loading: () => <div className="calendar-loading">Cargando notas...</div> },
);

const LoansModule = dynamic(
  () => import("@/components/finance/LoansModule").then((mod) => mod.LoansModule),
  { ssr: false, loading: () => <div className="calendar-loading">Cargando préstamos...</div> },
);
const LoanDialog = dynamic(
  () => import("@/components/finance/LoanDialog").then((mod) => mod.LoanDialog),
  { ssr: false },
);

const FinancialCalendar = dynamic(
  () => import("@/components/finance/FinancialCalendar").then((mod) => mod.FinancialCalendar),
  { ssr: false, loading: () => <div className="calendar-loading">Cargando calendario...</div> },
);

const ALERT_DAYS = 3;

type PageKey = "overview" | "activity" | "subscriptions" | "loans" | "notes" | "goals" | "calendar" | "reports" | "net-worth" | "assistant";

const navigation: { key: PageKey; label: string; icon: LucideIcon; group: string }[] = [
  { key: "overview", label: "Resumen", icon: LayoutDashboard, group: "PRINCIPAL" },
  { key: "activity", label: "Movimientos", icon: ArrowLeftRight, group: "PRINCIPAL" },
  { key: "subscriptions", label: "Suscripciones", icon: CreditCard, group: "PLANIFICACIÓN" },
  { key: "loans", label: "Préstamos", icon: Activity, group: "PLANIFICACIÓN" },
  { key: "notes", label: "Notas", icon: StickyNote, group: "PLANIFICACIÓN" },
  { key: "goals", label: "Metas", icon: Goal, group: "PLANIFICACIÓN" },
  { key: "calendar", label: "Calendario", icon: CalendarDays, group: "PLANIFICACIÓN" },
  { key: "reports", label: "Informes", icon: FileText, group: "ANÁLISIS" },
  { key: "net-worth", label: "Patrimonio", icon: TrendingUp, group: "ANÁLISIS" },
  { key: "assistant", label: "MoneyPilot AI", icon: Sparkles, group: "ANÁLISIS" },
];

const kindLabel: Record<RecordKind, string> = {
  income: "Ingreso",
  expense: "Gasto",
  subscription: "Suscripción",
  loan: "Préstamo",
  goal: "Meta",
  asset: "Activo",
  liability: "Pasivo",
  note: "Nota",
};

const kindColor: Record<RecordKind, string> = {
  income: "green",
  expense: "red",
  subscription: "orange",
  loan: "blue",
  goal: "purple",
  asset: "green",
  liability: "red",
  note: "purple",
};

const defaultCategory: Record<RecordKind, string> = {
  income: "Salario",
  expense: "Hogar",
  subscription: "Entretenimiento",
  loan: "Préstamos",
  goal: "Ahorro",
  asset: "Efectivo",
  liability: "Otros pasivos",
  note: "Nota",
};

const recordSchema = z.object({
  kind: z.enum(["income", "expense", "subscription", "loan", "goal", "asset", "liability", "note"]),
  name: z.string().trim().min(2, "Escribe al menos 2 caracteres"),
  category: z.string().trim().min(1, "Selecciona una categoría"),
  amount: z.coerce.number().positive("El monto debe ser mayor que cero"),
  date: z.string().min(1, "Selecciona una fecha"),
  description: z.string().optional(),
  targetAmount: z.union([z.coerce.number().positive(), z.literal("")]).optional(),
  dueDay: z.union([z.coerce.number().int().min(1).max(31), z.literal("")]).optional(),
  interestRate: z.union([z.coerce.number().min(0).max(100), z.literal("")]).optional(),
  endDate: z.string().optional(),
  cancelled: z.boolean().optional(),
});

const backupRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["income", "expense", "subscription", "loan", "goal", "asset", "liability", "note"]),
  name: z.string().trim().min(1),
  category: z.string().trim().min(1),
  amount: z.number().finite().min(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  targetAmount: z.number().finite().positive().optional(),
  interestRate: z.number().finite().min(0).max(100).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cancelled: z.boolean().optional(),
  color: z.string().optional(),
  body: z.string().optional(),
  items: z.array(z.object({
    id: z.string(),
    text: z.string(),
    done: z.boolean(),
    due: z.string().optional(),
    budget: z.number().finite().optional(),
  })).optional(),
  lender: z.string().optional(),
  loanType: z.enum(["french", "german", "custom"]).optional(),
  principalAmount: z.number().finite().optional(),
  termMonths: z.number().int().optional(),
  schedule: z.array(z.object({
    n: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    payment: z.number().finite(),
    principal: z.number().finite(),
    interest: z.number().finite(),
    fees: z.number().finite(),
    balance: z.number().finite(),
    paid: z.boolean().optional(),
  })).optional(),
});

const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  records: z.array(backupRecordSchema),
});

type RecordForm = z.infer<typeof recordSchema>;

function RecordDialog({
  onClose,
  onSave,
  initialKind,
  record: initialRecord,
}: {
  onClose: () => void;
  onSave: (record: FinanceRecord) => Promise<void>;
  initialKind: RecordKind;
  record?: FinanceRecord | null;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof recordSchema>, unknown, RecordForm>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      kind: initialRecord?.kind ?? initialKind,
      name: initialRecord?.name ?? "",
      category: initialRecord?.category ?? defaultCategory[initialKind],
      amount: initialRecord?.amount,
      date: initialRecord?.date ?? localDateString(),
      description: initialRecord?.description ?? "",
      targetAmount: initialRecord?.targetAmount ?? "",
      dueDay: initialRecord?.dueDay ?? "",
      interestRate: initialRecord?.interestRate ?? "",
      endDate: initialRecord?.endDate ?? "",
      cancelled: initialRecord?.cancelled ?? false,
    },
  });
  const selectedKind = useWatch({ control, name: "kind" });

  const submit = async (values: RecordForm) => {
    const record: FinanceRecord = {
      id: initialRecord?.id ?? crypto.randomUUID(),
      kind: values.kind,
      name: values.name,
      category: values.category,
      amount: values.amount,
      date: values.date,
      description: values.description,
      targetAmount: values.targetAmount ? Number(values.targetAmount) : undefined,
      dueDay: values.dueDay ? Number(values.dueDay) : undefined,
      interestRate: values.interestRate !== "" && values.interestRate !== undefined
        ? Number(values.interestRate)
        : undefined,
      endDate: values.endDate || undefined,
      cancelled: values.kind === "subscription" && values.cancelled ? true : undefined,
    };
    await onSave(record);
    onClose();
  };

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <motion.div
        className="dialog glass-panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="dialog-head">
          <div>
            <span className="eyebrow">NUEVO REGISTRO</span>
            <h2 id="dialog-title">Añade un movimiento</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <form className="record-form" onSubmit={handleSubmit(submit)}>
          <label className="field-label">Tipo de registro
            <select {...register("kind")}>
              {Object.entries(kindLabel).filter(([value]) => value !== "note").map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field-label">Nombre
            <input {...register("name")} placeholder={selectedKind === "income" ? "Ej. Nómina" : "Ej. Supermercado"} />
            {errors.name && <span className="field-error">{errors.name.message}</span>}
          </label>
          <div className="form-row">
            <label className="field-label">Monto
              <div className="amount-input"><span>$</span><input {...register("amount")} type="number" step="0.01" min="0" placeholder="0.00" /></div>
              {errors.amount && <span className="field-error">{errors.amount.message}</span>}
            </label>
            <label className="field-label">Fecha
              <input {...register("date")} type="date" />
              {errors.date && <span className="field-error">{errors.date.message}</span>}
            </label>
          </div>
          <div className="form-row">
            <label className="field-label">Categoría
              <input {...register("category")} list="finance-categories" placeholder="Escribe o elige una categoría" />
              <datalist id="finance-categories">
                {["Hogar", "Comida", "Transporte", "Salario", "Freelance", "Entretenimiento", "Productividad", "Ahorro", "Inversiones", "Efectivo", "Otros"].map((category) => <option key={category} value={category} />)}
              </datalist>
            </label>
            {selectedKind === "subscription" && (
              <label className="field-label">Día de cobro
                <input {...register("dueDay")} type="number" min="1" max="31" placeholder="1–31" />
                {errors.dueDay && <span className="field-error">Elige un día entre 1 y 31</span>}
              </label>
            )}
            {(selectedKind === "goal" || selectedKind === "loan") && (
              <label className="field-label">{selectedKind === "goal" ? "Monto objetivo" : "Monto inicial"}
                <input {...register("targetAmount")} type="number" step="0.01" min="0" placeholder="0.00" />
              </label>
            )}
          </div>
          {selectedKind === "loan" && (
            <div className="form-row">
              <label className="field-label">Interés anual (%)
                <input {...register("interestRate")} type="number" step="0.01" min="0" max="100" placeholder="0.00" />
                {errors.interestRate && <span className="field-error">Usa un valor entre 0 y 100</span>}
              </label>
              <label className="field-label">Fecha estimada de fin
                <input {...register("endDate")} type="date" />
              </label>
            </div>
          )}
          {selectedKind === "subscription" && (
            <label className="check-label"><input type="checkbox" {...register("cancelled")} /> Suscripción cancelada (no se contará ni avisará de cobros)</label>
          )}
          <label className="field-label">Nota <span className="optional-label">OPCIONAL</span>
            <textarea {...register("description")} rows={2} placeholder="Añade un detalle..." />
          </label>
          <button className="primary-button dialog-submit" disabled={isSubmitting} type="submit">
            <Plus size={17} /> Guardar registro
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <motion.div className="metric-card glass-panel" whileHover={{ y: -3 }} transition={{ duration: 0.18 }}>
      <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={17} /></span></div>
      <div className="metric-value">{value}</div>
      <div className="metric-foot"><span>{delta}</span></div>
    </motion.div>
  );
}

function MovementRow({
  record,
  onDelete,
  onEdit,
}: {
  record: FinanceRecord;
  onDelete?: (id: string) => void;
  onEdit?: (record: FinanceRecord) => void;
}) {
  const isIncome = record.kind === "income";
  return (
    <div className="movement-row">
      <div className={`movement-icon ${kindColor[record.kind]}`}>
        {isIncome ? <ArrowDownLeft size={17} /> : record.kind === "subscription" ? <CreditCard size={16} /> : <ArrowUpRight size={17} />}
      </div>
      <div className="movement-main">
        <strong>{record.name}</strong>
        <span>{record.category} · {formatDate(record.date)}</span>
      </div>
      <div className="movement-amount">
        <strong className={isIncome ? "text-green" : ""}>{isIncome ? "+" : "−"}{currency(record.amount)}</strong>
        {onEdit && <button className="delete-record" onClick={() => onEdit(record)} aria-label={`Editar ${record.name}`}><Edit2 size={13} /></button>}
        {onDelete && <button className="delete-record" onClick={() => onDelete(record.id)} aria-label={`Eliminar ${record.name}`}><X size={14} /></button>}
      </div>
    </div>
  );
}

export default function Home() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);
  const reset = useFinanceStore((state) => state.reset);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => setUser(me))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    reset();
    setUser(null);
  };

  if (checking) return <div className="loading-state"><div className="loading-orbit" /></div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return <Dashboard key={user.id} user={user} onLogout={logout} />;
}

function Dashboard({ user, onLogout }: { user: SessionUser; onLogout: () => void }) {
  const { records, hydrated, hydrate, addRecord, removeRecord, replaceRecords } = useFinanceStore();
  const [activePage, setActivePage] = useState<PageKey>("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecord | null>(null);
  const [loanDialog, setLoanDialog] = useState<{ loan: FinanceRecord | null } | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<"all" | "income" | "expense">("all");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [notice, setNotice] = useState("");
  const [todayLabel, setTodayLabel] = useState("");
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void hydrate();
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
    setTodayLabel(new Intl.DateTimeFormat("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()).toUpperCase());
  }, [hydrate]);

  const transactions = useMemo(
    () => records
      .filter((record) => record.kind === "income" || record.kind === "expense")
      .sort((a, b) => b.date.localeCompare(a.date)),
    [records],
  );
  const currentMonth = localDateString().slice(0, 7);
  const monthlyTransactions = transactions.filter((record) => record.date.startsWith(currentMonth));
  const incomes = monthlyTransactions.filter((record) => record.kind === "income").reduce((sum, record) => sum + record.amount, 0);
  const expenses = monthlyTransactions.filter((record) => record.kind === "expense").reduce((sum, record) => sum + record.amount, 0);
  const assets = records.filter((record) => record.kind === "asset").reduce((sum, record) => sum + record.amount, 0);
  const liquidAssets = records
    .filter((record) => record.kind === "asset" && ["efectivo", "ahorros"].includes(record.category.toLowerCase()))
    .reduce((sum, record) => sum + record.amount, 0);
  const liabilities = records.filter((record) => record.kind === "liability" || record.kind === "loan").reduce((sum, record) => sum + record.amount, 0);
  const allSubscriptions = records.filter((record) => record.kind === "subscription");
  const subscriptions = allSubscriptions.filter((record) => !record.cancelled);
  const goals = records.filter((record) => record.kind === "goal");
  const loans = records.filter((record) => record.kind === "loan");
  const currentBalance = liquidAssets;
  const netWorth = assets - liabilities;
  const monthlySubscriptions = subscriptions.reduce((sum, record) => sum + record.amount, 0);
  const upcomingSubscriptions = subscriptions
    .slice()
    .sort((a, b) =>
      nextChargeDate(a.dueDay, a.date).localeCompare(nextChargeDate(b.dueDay, b.date)),
    );
  const debtRatio = assets > 0 ? liabilities / assets : liabilities > 0 ? 1 : 0;
  const debtLevel = liabilities === 0 ? "Sin deudas" : debtRatio < 0.3 ? "Bajo" : debtRatio < 0.6 ? "Moderado" : "Alto";
  const categoryTotals = Object.entries(
    monthlyTransactions
      .filter((record) => record.kind === "expense")
      .reduce<Record<string, number>>((acc, record) => ({ ...acc, [record.category]: (acc[record.category] ?? 0) + record.amount }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const categoryColors = ["blue", "purple", "orange", "green"];
  const topCategories = categoryTotals.slice(0, 4).map(([name, total], index) => ({
    name,
    percent: Math.round((total / expenses) * 100),
    color: categoryColors[index],
  }));
  const goalProgress = goals.length
    ? goals.reduce((sum, goal) => sum + Math.min(goal.amount / (goal.targetAmount ?? goal.amount), 1), 0) / goals.length
    : 0;
  const hasData = records.length > 0;
  const savingsRate = incomes > 0 ? (incomes - expenses) / incomes : 0;
  const healthScore = hasData
    ? Math.round(Math.min(100, Math.max(0,
        40 + savingsRate * 60 + (1 - Math.min(debtRatio, 1)) * 20 + goalProgress * 10 - (incomes === 0 ? 20 : 0))))
    : 0;
  const healthLabel = !hasData ? "Sin datos" : healthScore >= 80 ? "Muy saludable" : healthScore >= 60 ? "Saludable" : healthScore >= 40 ? "En desarrollo" : "Requiere atención";
  const insights = [
    {
      icon: TrendingUp, tone: "green",
      title: netWorth > 0 ? "Tu patrimonio es positivo" : "Aún sin patrimonio registrado",
      body: hasData ? `Tu patrimonio neto actual es ${currency(netWorth)} (activos ${currency(assets)} − pasivos ${currency(liabilities)}).` : "Añade activos y pasivos para calcular tu patrimonio neto.",
    },
    {
      icon: Lightbulb, tone: "purple",
      title: "Suscripciones",
      body: subscriptions.length
        ? `Tus ${subscriptions.length} suscripciones suman ${currency(monthlySubscriptions)} al mes${expenses + monthlySubscriptions > 0 ? ` (${Math.round(monthlySubscriptions / (expenses + monthlySubscriptions) * 100)}% de tu gasto mensual)` : ""}.`
        : "No has registrado suscripciones todavía.",
    },
    {
      icon: ShieldCheck, tone: "blue",
      title: `Nivel de deuda: ${debtLevel.toLowerCase()}`,
      body: liabilities > 0 ? `Tus pasivos representan el ${Math.round(debtRatio * 100)}% de tus activos.` : "No tienes deudas registradas.",
    },
    {
      icon: Goal, tone: "orange",
      title: "Metas",
      body: goals.length ? `Tienes ${goals.length} metas con un progreso promedio de ${Math.round(goalProgress * 100)}%.` : "Crea tu primera meta para empezar a medir tu progreso.",
    },
  ];
  const todayStart = new Date(`${localDateString()}T00:00:00`).getTime();
  const loanCharges = loans.flatMap((loan) => {
    const installment = loan.schedule?.find((row) => !row.paid);
    return installment
      ? [{ record: { ...loan, name: `${loan.name} · cuota ${installment.n}`, amount: installment.payment }, next: installment.date }]
      : [];
  });
  const dueAlerts = [
    ...subscriptions.map((record) => ({ record, next: nextChargeDate(record.dueDay, record.date) })),
    ...loanCharges,
  ]
    .map(({ record, next }) => {
      const days = Math.round((new Date(`${next}T00:00:00`).getTime() - todayStart) / 86400000);
      return { record, next, days };
    })
    .filter((alert) => alert.days >= 0 && alert.days <= ALERT_DAYS)
    .sort((a, b) => a.days - b.days);
  const dueLabel = (days: number) => (days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`);
  const activeLabel = navigation.find((item) => item.key === activePage)?.label ?? "Resumen";
  const filteredTransactions = transactions.filter((record) =>
    (transactionFilter === "all" || record.kind === transactionFilter) &&
    `${record.name} ${record.category}`.toLowerCase().includes(searchText.toLowerCase()),
  );

  const addKindByPage: Partial<Record<PageKey, RecordKind>> = {
    activity: "expense",
    subscriptions: "subscription",
    loans: "loan",
    goals: "goal",
    "net-worth": "asset",
  };

  const announce = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  };

  const exportBackup = () => {
    const backup: FinanceBackup = { version: 1, exportedAt: new Date().toISOString(), records };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `moneypilot-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    announce("Copia de seguridad descargada");
  };

  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const result = backupSchema.safeParse(JSON.parse(await file.text()));
      if (!result.success) {
        throw new Error("El archivo no tiene un formato de MoneyPilot válido.");
      }
      const backup: FinanceBackup = result.data;
      await replaceRecords(backup.records);
      announce(`${backup.records.length} registros importados correctamente`);
    } catch (error) {
      announce(error instanceof Error ? error.message : "No se pudo importar el archivo.");
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  };

  const alertedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || alertedRef.current || dueAlerts.length === 0) return;
    alertedRef.current = true;
    const first = dueAlerts[0];
    const message = dueAlerts.length === 1
      ? `${first.record.name} se cobra ${dueLabel(first.days)} (${currency(first.record.amount)})`
      : `${dueAlerts.length} pagos vencen en los próximos ${ALERT_DAYS} días`;
    announce(message);
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification("MoneyPilot AI · Cobro próximo", { body: message, icon: "/icon.svg" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, dueAlerts.length]);

  const enableSystemAlerts = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") announce("Avisos del sistema activados");
  };

  const toggleCancelled = async (record: FinanceRecord) => {
    await addRecord({ ...record, cancelled: record.cancelled ? undefined : true });
    announce(record.cancelled ? `${record.name} reactivada` : `${record.name} marcada como cancelada`);
  };

  const handleDelete = async (id: string) => {
    // Al borrar un préstamo también se eliminan los gastos generados por sus cuotas pagadas.
    const loan = records.find((record) => record.id === id && record.kind === "loan");
    if (loan?.schedule) {
      for (const row of loan.schedule) if (row.paid) await removeRecord(`loanpay-${id}-${row.n}`);
    }
    await removeRecord(id);
    announce("Registro eliminado");
  };

  const openNewRecord = () => {
    setEditingRecord(null);
    setDialogOpen(true);
  };

  const openEditRecord = (record: FinanceRecord) => {
    setEditingRecord(record);
    setDialogOpen(true);
  };

  const changePage = (page: PageKey) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    setSearchText("");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><span /></div>
          <span className="brand-name">money<span>pilot</span></span>
          <button className="icon-button mobile-close" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú"><X size={18} /></button>
        </div>
        <button className="workspace-switcher">
          <div className="workspace-avatar">M</div>
          <span><strong>Mi espacio</strong><small>Espacio personal</small></span>
          <ChevronDown size={15} />
        </button>
        <nav className="side-nav" aria-label="Navegación principal">
          {["PRINCIPAL", "PLANIFICACIÓN", "ANÁLISIS"].map((group) => (
            <div className="nav-group" key={group}>
              <span className="nav-heading">{group}</span>
              {navigation.filter((item) => item.group === group).map(({ key, label, icon: Icon }) => (
                <button key={key} className={`nav-item ${activePage === key ? "active" : ""}`} onClick={() => changePage(key)}>
                  <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                  {key === "assistant" && <span className="nav-new">AI</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <div className="privacy-icon"><ShieldCheck size={17} /></div>
            <div><strong>Cuenta privada</strong><span>Tus datos son solo tuyos.</span></div>
          </div>
          <button className="nav-item" onClick={exportBackup}><Download size={17} /><span>Exportar datos</span></button>
          <button className="nav-item" onClick={() => importRef.current?.click()}><Settings2 size={17} /><span>Importar respaldo</span></button>
          <div className="sidebar-profile">
            <div className="profile-avatar">MP</div><div><strong>Mi espacio</strong><span>Plan personal</span></div><MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <button className="mobile-scrim" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar menú" />}

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir menú"><Menu size={19} /></button>
            <span className="breadcrumb">Workspace</span><ChevronRight size={14} /><span className="breadcrumb-current">{activeLabel}</span>
          </div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={16} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Buscar..." aria-label="Buscar movimientos" /><kbd>⌘ K</kbd></label>
            <ThemeToggle />
            <button className="icon-button notification-button" aria-label={dueAlerts.length ? `${dueAlerts.length} cobros próximos` : "Notificaciones"} onClick={() => changePage("subscriptions")}><Bell size={17} />{dueAlerts.length > 0 && <i />}</button>
            <button className="topbar-avatar" aria-label={`Cerrar sesión de ${user.name}`} title={`${user.name} · Cerrar sesión`} onClick={onLogout}>{user.name.slice(0, 2).toUpperCase()}</button>
          </div>
        </header>
        <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => void importBackup(event.target.files?.[0])} />

        <div className="page-content">
          {!hydrated ? (
            <div className="loading-state"><div className="loading-orbit" /><span>Preparando tu espacio financiero...</span></div>
          ) : (
            <motion.div key={activePage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
              {activePage === "overview" && (
                <>
                  <div className="page-heading">
                    <div><div className="eyebrow"><span className="live-dot" /> {todayLabel || "RESUMEN DE HOY"}</div><h1>Hola, bienvenido <span className="wave">✦</span></h1><p>{hasData ? "Tu dinero, en perspectiva. Aquí tienes tu resumen financiero." : "Empieza registrando tu primer movimiento, suscripción o meta."}</p></div>
                    <button className="primary-button" onClick={openNewRecord}><Plus size={17} /> Nuevo movimiento</button>
                  </div>
                  {dueAlerts.length > 0 && <div className="due-banner" role="alert"><div className="due-icon"><BellRing size={18} /></div><div className="due-list">{dueAlerts.map(({ record, days }) => <span key={record.id}><strong>{record.name}</strong> se cobra {dueLabel(days)} · {currency(record.amount)}</span>)}</div>{notifPermission === "default" && <button className="insight-action" onClick={() => void enableSystemAlerts()}>Activar avisos del sistema</button>}<button className="insight-action" onClick={() => changePage("subscriptions")}>Ver suscripciones <ArrowUpRight size={15} /></button></div>}
                  <div className="hero-grid">
                    <section className="balance-card">
                      <div className="balance-glow" />
                      <div className="balance-head"><span className="balance-label"><Wallet size={16} /> SALDO TOTAL</span><button className="balance-menu"><MoreHorizontal size={20} /></button></div>
                      <div className="balance-value">{currency(currentBalance)}</div>
                      <div className="balance-change"><span>Efectivo y ahorros registrados</span></div>
                      <div className="balance-chart"><BalanceChart records={records} /></div>
                    </section>
                    <section className="account-card glass-panel">
                      <div className="card-top"><span className="balance-label">TU PATRIMONIO</span><span className="card-dots"><i /><i /><i /></span></div>
                      <div className="account-chip"><div className="chip-lines" /></div>
                      <div className="account-number">{currency(netWorth)}</div>
                      <div className="account-bottom"><div><span>DISPONIBLE</span><strong>{currency(currentBalance)}</strong></div><div className="visa-word">MP</div></div>
                      <div className="account-meta"><span><i className="visa-dot" /> Patrimonio neto</span><span>Actualizado ahora</span></div>
                    </section>
                  </div>
                  <div className="metrics-grid">
                    <MetricCard label="Ingresos del mes" value={currency(incomes)}                     delta="registrados este mes" icon={ArrowDownLeft} tone="green" />
                                        <MetricCard label="Gastos del mes" value={currency(expenses)} delta="registrados este mes" icon={ArrowUpRight} tone="red" />
                                        <MetricCard label="Ahorro disponible" value={currency(Math.max(currentBalance - monthlySubscriptions, 0))} delta="efectivo y ahorros" icon={Wallet} tone="blue" />
                                        <MetricCard label="Patrimonio neto" value={currency(netWorth)} delta="activos − pasivos" icon={TrendingUp} tone="purple" />
                  </div>
                  <div className="content-grid">
                    <section className="panel chart-panel">
                      <div className="section-head"><div><h2>Flujo de efectivo</h2>                      <p>Flujo acumulado de ingresos menos gastos</p></div><button className="select-button">Últimos 6 meses <ChevronDown size={14} /></button></div>
                                            <BalanceChart records={records} detailed />
                    </section>
                    <section className="panel">
                      <div className="section-head"><div><h2>Desglose mensual</h2><p>Resumen de este periodo</p></div><button className="icon-button" onClick={() => changePage("reports")} aria-label="Ver informes"><ArrowUpRight size={17} /></button></div>
                      <div className="summary-total"><span>Total gastado</span><strong>{currency(expenses + monthlySubscriptions)}</strong></div>
                      <div className="category-list">
                        {topCategories.map(({ name, percent, color }) => (
                          <div className="category-row" key={name}><div className="category-label"><span className={`category-dot ${color}`} />{name}<span>{percent}%</span></div><div className="progress-track"><span className={`progress-fill ${color}`} style={{ width: `${percent}%` }} /></div></div>
                        ))}
                        {topCategories.length === 0 && <EmptyState text="Aún no hay gastos este mes." />}
                      </div>
                      <button className="text-link" onClick={() => changePage("reports")}>Ver análisis completo <ArrowUpRight size={14} /></button>
                    </section>
                  </div>
                  <div className="content-grid lower-grid">
                    <section className="panel">
                      <div className="section-head"><div><h2>Actividad reciente</h2><p>Tus últimos movimientos</p></div><button className="text-link" onClick={() => changePage("activity")}>Ver todos <ArrowUpRight size={14} /></button></div>
                      <div className="movement-list">{transactions.slice(0, 5).map((record) => <MovementRow key={record.id} record={record} />)}{transactions.length === 0 && <EmptyState text="Todavía no hay movimientos. Añade el primero." />}</div>
                    </section>
                    <section className="panel">
                      <div className="section-head"><div><h2>Próximos pagos</h2><p>Suscripciones activas</p></div><button className="icon-button" onClick={() => changePage("subscriptions")} aria-label="Ver suscripciones"><ArrowUpRight size={17} /></button></div>
                      <div className="upcoming-list">{upcomingSubscriptions.slice(0, 3).map((record) => (
                        <div className="upcoming-row" key={record.id}><BrandLogo name={record.name} /><div className="movement-main"><strong>{record.name}</strong><span>Próximo cobro · {formatDate(nextChargeDate(record.dueDay, record.date))}</span></div><strong>{currency(record.amount)}</strong></div>
                                              ))}{upcomingSubscriptions.length === 0 && <EmptyState text="No tienes suscripciones registradas." />}</div>
                      <div className="subscription-total"><span>Total mensual</span><strong>{currency(monthlySubscriptions)}<small>/mes</small></strong></div>
                    </section>
                  </div>
                  <section className="insight-banner">
                    <div className="insight-spark"><Sparkles size={20} /></div><div><span className="eyebrow">MONEYPILOT INSIGHT</span><p>{incomes > 0 ? <>Este mes tu tasa de ahorro es <strong>{Math.round(savingsRate * 100)}%</strong> de tus ingresos registrados.</> : "Registra tus ingresos y gastos para recibir un análisis personalizado."}</p></div>
                    <button className="insight-action" onClick={() => changePage("assistant")}>Ver mi análisis <ArrowUpRight size={15} /></button>
                  </section>
                </>
              )}

              {activePage === "activity" && (
                <ModulePage title="Movimientos" subtitle="Todos tus ingresos y gastos, en un solo lugar." actionLabel="Nuevo movimiento" onAction={openNewRecord}>
                  <div className="panel module-panel"><div className="module-toolbar"><div className="filter-pills"><button className={`filter-pill ${transactionFilter === "all" ? "selected" : ""}`} onClick={() => setTransactionFilter("all")}>Todos</button><button className={`filter-pill ${transactionFilter === "income" ? "selected" : ""}`} onClick={() => setTransactionFilter("income")}>Ingresos</button><button className={`filter-pill ${transactionFilter === "expense" ? "selected" : ""}`} onClick={() => setTransactionFilter("expense")}>Gastos</button></div><span className="record-count">{filteredTransactions.length} movimientos</span></div><div className="movement-list">{filteredTransactions.map((record) => <MovementRow key={record.id} record={record} onEdit={openEditRecord} onDelete={(id) => void handleDelete(id)} />)}{filteredTransactions.length === 0 && <EmptyState text="No hay movimientos que coincidan con tu búsqueda." />}</div></div>
                </ModulePage>
              )}

              {activePage === "subscriptions" && (
                <ModulePage title="Suscripciones" subtitle="Controla tus pagos recurrentes y evita sorpresas." actionLabel="Añadir suscripción" onAction={openNewRecord}>
                  {dueAlerts.length > 0 && <div className="due-banner" role="alert"><div className="due-icon"><BellRing size={18} /></div><div className="due-list">{dueAlerts.map(({ record, days }) => <span key={record.id}><strong>{record.name}</strong> se cobra {dueLabel(days)} · {currency(record.amount)}</span>)}</div>{notifPermission === "default" && <button className="insight-action" onClick={() => void enableSystemAlerts()}>Activar avisos del sistema</button>}</div>}
                  <div className="metrics-grid three"><MetricCard label="Gasto mensual" value={currency(monthlySubscriptions)} delta={`${subscriptions.length} activas`} icon={CreditCard} tone="orange" /><MetricCard label="Proyección anual" value={currency(monthlySubscriptions * 12)} delta="estimado" icon={TrendingUp} tone="blue" /><MetricCard label="Próximo cobro" value={upcomingSubscriptions.length ? formatDate(nextChargeDate(upcomingSubscriptions[0].dueDay, upcomingSubscriptions[0].date)) : "—"} delta={upcomingSubscriptions[0]?.name ?? "Sin pagos"} icon={CalendarDays} tone="purple" /></div>
                  <div className="panel module-panel"><div className="section-head"><div><h2>Tus servicios</h2><p>{subscriptions.length} activas · {allSubscriptions.length - subscriptions.length} canceladas</p></div></div>{allSubscriptions.length === 0 && <EmptyState text="Añade Spotify, Netflix, YouTube y más para controlar tus cobros." />}<div className="subscription-cards">{allSubscriptions.map((record) => { const due = dueAlerts.find((alert) => alert.record.id === record.id); return <div className={`subscription-card ${record.cancelled ? "is-cancelled" : ""} ${due ? "is-due" : ""}`} key={record.id}><div className="subscription-card-top"><BrandLogo name={record.name} size={38} /><div><button className="delete-record" onClick={() => void toggleCancelled(record)} aria-label={record.cancelled ? `Reactivar ${record.name}` : `Cancelar ${record.name}`} title={record.cancelled ? "Reactivar" : "Marcar como cancelada"}>{record.cancelled ? <RotateCcw size={14} /> : <Ban size={14} />}</button><button className="delete-record" onClick={() => openEditRecord(record)} aria-label={`Editar ${record.name}`}><Edit2 size={14} /></button><button className="delete-record" onClick={() => void handleDelete(record.id)} aria-label={`Eliminar ${record.name}`}><X size={14} /></button></div></div><h3>{record.name}</h3><span className="muted-copy">{record.category}</span>{record.cancelled ? <span className="status-badge cancelled">Cancelada</span> : due ? <span className="status-badge due"><BellRing size={11} /> Se cobra {dueLabel(due.days)}</span> : <span className="status-badge active">Activa</span>}<div className="subscription-card-bottom"><strong>{currency(record.amount)}<small>/mes</small></strong><span>{record.cancelled ? "Sin cobros" : `Próximo · ${formatDate(nextChargeDate(record.dueDay, record.date))}`}</span></div></div>; })}</div></div>
                </ModulePage>
              )}

              {activePage === "loans" && (
                <ModulePage title="Préstamos" subtitle="Cuotas reales de tu banco, capital e interés mes a mes." actionLabel="Añadir préstamo" onAction={() => setLoanDialog({ loan: null })}>
                  <LoansModule loans={loans} onSave={addRecord} onRemove={removeRecord} onEdit={(loan) => setLoanDialog({ loan })} onDelete={(id) => void handleDelete(id)} monthlyIncome={incomes} monthlySubscriptions={monthlySubscriptions} />
                </ModulePage>
              )}

              {activePage === "notes" && (
                <NotesModule notes={records.filter((record) => record.kind === "note")} onSave={addRecord} onRemove={removeRecord} />
              )}

              {activePage === "goals" && (
                <ModulePage title="Metas financieras" subtitle="Pequeños pasos hoy. Grandes logros mañana." actionLabel="Crear meta" onAction={openNewRecord}>
                  <div className="goal-banner"><div className="goal-banner-icon"><Goal size={20} /></div><div><span className="eyebrow">TU PROGRESO ESTE MES</span><strong>{goals.length ? `${Math.round(goals.reduce((sum, goal) => sum + Math.min(goal.amount / (goal.targetAmount ?? goal.amount) * 100, 100), 0) / goals.length)}%` : "0%"} de progreso promedio</strong><span>Vas construyendo hábitos que hacen la diferencia.</span></div><div className="goal-confetti">✳</div></div>
                  <div className="goal-grid">{goals.map((goal, index) => { const percent = Math.min(Math.round(goal.amount / (goal.targetAmount ?? goal.amount) * 100), 100); return <div className="panel goal-card" key={goal.id}><div className="goal-card-head"><span className={`goal-icon goal-${index % 2}`}><Goal size={18} /></span><div><button className="delete-record" onClick={() => openEditRecord(goal)} aria-label={`Editar ${goal.name}`}><Edit2 size={13} /></button><button className="delete-record" onClick={() => void handleDelete(goal.id)} aria-label={`Eliminar ${goal.name}`}><X size={14} /></button></div></div><h3>{goal.name}</h3><p>{percent >= 100 ? "¡Meta cumplida!" : `Objetivo · ${formatDate(goal.date)}`}</p><div className="goal-amounts"><strong>{currency(goal.amount)}</strong><span>de {currency(goal.targetAmount ?? goal.amount)}</span></div><div className="progress-track"><span className="progress-fill purple" style={{ width: `${percent}%` }} /></div><div className="goal-footer"><span>{percent}% completado</span><span>{percent >= 100 ? <Check size={14} /> : `Faltan ${currency(Math.max((goal.targetAmount ?? goal.amount) - goal.amount, 0))}`}</span></div></div>; })}{goals.length === 0 && <EmptyState text="Crea una meta y empieza a planificar tu siguiente logro." />}</div>
                </ModulePage>
              )}

              {activePage === "calendar" && (
                <ModulePage title="Calendario financiero" subtitle="Anticípate a los movimientos importantes de cada mes.">
                  <div className="panel module-panel calendar-panel"><div className="calendar-legend">{[["Ingreso", "green"], ["Gasto", "red"], ["Suscripción", "orange"], ["Préstamo", "blue"], ["Meta", "purple"]].map(([label, tone]) => <span key={label}><i className={`legend-dot ${tone}`} />{label}</span>)}</div><FinancialCalendar records={records} /></div>
                </ModulePage>
              )}

              {activePage === "reports" && (
                <ModulePage title="Informes" subtitle="Una visión clara de cómo se mueve tu dinero."><div className="metrics-grid three"><MetricCard label="Ingresos registrados" value={currency(incomes)} delta="este periodo" icon={ArrowDownLeft} tone="green" /><MetricCard label="Gastos registrados" value={currency(expenses)} delta="este periodo" icon={ArrowDownRight} tone="red" /><MetricCard label="Balance neto" value={currency(incomes - expenses)} delta="flujo positivo" icon={TrendingUp} tone="blue" /></div><div className="panel chart-panel reports-chart"><div className="section-head"><div><h2>Evolución del saldo</h2><p>Flujo acumulado de los últimos 6 meses</p></div><button className="select-button">6 meses <ChevronDown size={14} /></button></div><BalanceChart records={records} detailed /></div><div className="content-grid"><div className="panel"><div className="section-head"><div><h2>Ingresos vs. gastos</h2><p>Resumen del periodo</p></div></div><div className="report-comparison"><div><span className="category-dot green" />Ingresos<strong>{currency(incomes)}</strong></div><div><span className="category-dot red" />Gastos<strong>{currency(expenses)}</strong></div></div></div><div className="panel"><div className="section-head"><div><h2>Ahorro estimado</h2><p>Ingresos menos gastos</p></div></div><div className="report-savings">{currency(incomes - expenses)}<span><TrendingUp size={15} /> {incomes - expenses >= 0 ? "Balance positivo" : "Balance negativo"}</span></div></div></div></ModulePage>
              )}

              {activePage === "net-worth" && (
                <ModulePage title="Patrimonio neto" subtitle="Una imagen completa de lo que tienes y lo que debes." actionLabel="Añadir activo" onAction={openNewRecord}>
                  <div className="net-worth-hero"><div className="net-worth-orb" /><span className="eyebrow">PATRIMONIO NETO ACTUAL</span><strong>{currency(netWorth)}</strong><span className="net-worth-change">{currency(assets)} activos − {currency(liabilities)} pasivos</span><div className="net-worth-chart"><BalanceChart records={records} /></div></div>
                  <div className="content-grid net-worth-columns"><section className="panel"><div className="section-head"><div><h2>Activos</h2><p>Lo que tienes</p></div><strong className="text-green">{currency(assets)}</strong></div>{records.filter((record) => record.kind === "asset").map((record) => <div className="asset-row" key={record.id}><span><i className="category-dot green" />{record.name}</span><strong>{currency(record.amount)}</strong><button className="delete-record" onClick={() => openEditRecord(record)} aria-label={`Editar ${record.name}`}><Edit2 size={13} /></button><button className="delete-record" onClick={() => void handleDelete(record.id)} aria-label={`Eliminar ${record.name}`}><X size={14} /></button></div>)}</section><section className="panel"><div className="section-head"><div><h2>Pasivos</h2><p>Lo que debes</p></div><strong className="text-red">{currency(liabilities)}</strong></div>{records.filter((record) => record.kind === "liability" || record.kind === "loan").map((record) => <div className="asset-row" key={record.id}><span><i className="category-dot red" />{record.name}</span><strong>{currency(record.amount)}</strong><button className="delete-record" onClick={() => openEditRecord(record)} aria-label={`Editar ${record.name}`}><Edit2 size={13} /></button><button className="delete-record" onClick={() => void handleDelete(record.id)} aria-label={`Eliminar ${record.name}`}><X size={14} /></button></div>)}</section></div>
                </ModulePage>
              )}

              {activePage === "assistant" && (
                <ModulePage title="MoneyPilot AI" subtitle="Insights personalizados para tomar decisiones con confianza.">
                  <div className="ai-welcome"><div className="ai-orb"><Sparkles size={26} /></div><span className="eyebrow">TU COPILOTO FINANCIERO</span><h2>{hasData ? "Tu análisis financiero" : "Aún no hay datos que analizar."}</h2><p>Analizamos tu actividad local para encontrar oportunidades. Tus datos nunca salen de este dispositivo.</p><div className="financial-score"><div className="score-ring"><strong>{hasData ? healthScore : "—"}</strong><span>/100</span></div><div><span className="eyebrow">SCORE FINANCIERO</span><strong>{healthLabel}</strong></div></div></div>
                  <div className="ai-insight-grid">{insights.map((item) => <InsightCard key={item.title} icon={item.icon} title={item.title} body={item.body} tone={item.tone} />)}</div>
                </ModulePage>
              )}
            </motion.div>
          )}
          <footer className="page-footer"><span>© 2026 MoneyPilot AI</span><span><i className="footer-status" /> Tus datos se guardan en tu cuenta privada</span><button onClick={exportBackup}>Hacer copia de seguridad</button></footer>
        </div>
        <nav className="mobile-nav" aria-label="Navegación móvil">{navigation.slice(0, 5).map(({ key, label, icon: Icon }) => <button key={key} className={activePage === key ? "active" : ""} onClick={() => changePage(key)}><Icon size={19} /><span>{label}</span></button>)}</nav>
      </main>
      {dialogOpen && <RecordDialog key={editingRecord?.id ?? `new-${activePage}`} record={editingRecord} initialKind={addKindByPage[activePage] ?? "expense"} onClose={() => { setDialogOpen(false); setEditingRecord(null); }} onSave={addRecord} />}
      {loanDialog && <LoanDialog key={loanDialog.loan?.id ?? "new-loan"} loan={loanDialog.loan} onClose={() => setLoanDialog(null)} onSave={addRecord} />}
      {notice && <div className="toast-message"><Check size={16} />{notice}</div>}
    </div>
  );
}

function ModulePage({
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="page-heading module-heading"><div><div className="eyebrow"><span className="live-dot" /> TU ESPACIO FINANCIERO</div><h1>{title}</h1><p>{subtitle}</p></div>{actionLabel && <button className="primary-button" onClick={onAction}><Plus size={17} /> {actionLabel}</button>}</div>
      {children}
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><div className="empty-icon"><CircleHelp size={20} /></div><p>{text}</p></div>;
}

function InsightCard({ icon: Icon, title, body, tone }: { icon: LucideIcon; title: string; body: string; tone: string }) {
  return <div className="panel insight-card"><div className={`insight-card-icon ${tone}`}><Icon size={18} /></div><h3>{title}</h3><p>{body}</p><button className="text-link">Ver detalle <ArrowUpRight size={14} /></button></div>;
}
