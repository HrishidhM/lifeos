// Fixed locales keep server and browser output identical (no hydration mismatches).
const locale = (currency: string) => (currency === "INR" ? "en-IN" : "en-US");

export function money(n: number, currency: string) {
  try {
    return new Intl.NumberFormat(locale(currency), { style: "currency", currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
  } catch { return n.toFixed(2); }
}
/** Compact axis labels. INR uses the Indian convention (k, L, Cr); other currencies use K/M/B. */
export function compact(n: number, currency = "INR") {
  if (currency === "INR") {
    const a = Math.abs(n), sign = n < 0 ? "-" : "";
    const f = (v: number, unit: string) => `${sign}${Number(v.toFixed(1))}${unit}`;
    if (a >= 1e7) return f(a / 1e7, "Cr");
    if (a >= 1e5) return f(a / 1e5, "L");
    if (a >= 1e3) return f(a / 1e3, "k");
    return `${sign}${Math.round(a)}`;
  }
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}
export const pct = (n: number) => `${Math.round(n)}%`;
