export const currency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export const localDateString = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es", { month: "short", day: "numeric" }).format(
    new Date(`${value}T12:00:00`),
  );

export const nextChargeDate = (dueDay?: number, fallbackDate?: string) => {
  if (!dueDay || !fallbackDate) return fallbackDate ?? "";

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  const today = new Date(year, month, now.getDate());
  let candidate = new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));

  if (candidate < today) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
    candidate = new Date(year, month, Math.min(dueDay, new Date(year, month + 1, 0).getDate()));
  }

  return `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, "0")}-${String(candidate.getDate()).padStart(2, "0")}`;
};
