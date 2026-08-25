const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatMoney(n: number) {
  return money.format(n);
}

export function formatPct(n: number, digits = 2) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function formatVol(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return n.toFixed(0);
}

export function formatWeight(n: number) {
  return `${Math.round(n * 100)}% of book`;
}

export function signedClass(n: number) {
  if (n > 0) return "text-up";
  if (n < 0) return "text-down";
  return "text-mute";
}
